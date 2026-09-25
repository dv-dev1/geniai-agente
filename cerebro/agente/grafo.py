import os
from functools import cache
from typing import Literal

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel
from typing_extensions import TypedDict

from .lead import Etapa, Lead, Temperatura, etapa, mesclar, pontuar, temperatura
from .prompts import HORARIO, MAX_CARACTERES, MAX_MENSAGENS_BOT, PRECOS, SISTEMA, valores_em_reais


class Turno(TypedDict):
    autor: Literal["cliente", "bot", "humano"]
    texto: str


class Resposta(BaseModel):
    mensagem: str
    lead: Lead
    acao: Literal["continuar", "encaminhar_humano", "encerrar"]


class Estado(TypedDict, total=False):
    historico: list[Turno]
    lead: Lead
    msgs_bot: int
    telefone_conhecido: bool
    resposta: Resposta
    uso: dict[str, int]
    tentativas: int
    problemas: list[str]
    score: int
    temperatura: Temperatura
    etapa: Etapa


# ponytail: preço do gpt-4.1-mini; trocar OPENAI_MODEL pede trocar esta tabela.
PRECO_USD_POR_MILHAO = {"entrada": 0.40, "cache": 0.10, "saida": 1.60}


def custo_usd(uso: dict[str, int]) -> float:
    p = PRECO_USD_POR_MILHAO
    return ((uso["entrada"] - uso["cache"]) * p["entrada"] + uso["cache"] * p["cache"] + uso["saida"] * p["saida"]) / 1e6


@cache
def _modelo():
    llm = ChatOpenAI(model=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"), temperature=0.4, max_retries=2, timeout=30)
    return llm.with_structured_output(Resposta, method="json_schema", strict=True, include_raw=True)


def chamar_llm(mensagens: list[BaseMessage]) -> tuple[Resposta, dict[str, int]]:
    saida = _modelo().invoke(mensagens)
    if saida["parsed"] is None:
        raise RuntimeError(f"sem resposta estruturada: {saida['parsing_error']}")
    u = saida["raw"].usage_metadata or {}
    uso = {
        "entrada": u.get("input_tokens", 0),
        "cache": u.get("input_token_details", {}).get("cache_read", 0),
        "saida": u.get("output_tokens", 0),
    }
    return saida["parsed"], uso


def _mensagem(t: Turno) -> BaseMessage:
    if t["autor"] == "cliente":
        return HumanMessage(t["texto"])
    return AIMessage(f"[atendente humano] {t['texto']}" if t["autor"] == "humano" else t["texto"])


def _situacao(e: Estado) -> str:
    return (
        "Estado atual (não mostre ao cliente):\n"
        f"- mensagens que você já enviou: {e['msgs_bot']} de no máximo {MAX_MENSAGENS_BOT}\n"
        f"- telefone_conhecido: {'sim' if e['telefone_conhecido'] else 'não'}\n"
        f"- dados do lead até agora: {e['lead'].model_dump_json()}"
    )


TENTATIVAS = 2
# Por ação: quem pediu humano segue encaminhado, quem encerrou segue encerrado.
FALA_SEGURA = {
    "continuar": "Esse valor o especialista da GeniAI confirma com você. Quer que eu passe seu contato para ele?",
    "encaminhar_humano": f"Obrigada! Vou passar sua conversa para um especialista da GeniAI, que responde {HORARIO}.",
    "encerrar": "Obrigada pelo contato! Quando quiser retomar, é só chamar por aqui.",
}


def precos_inventados(mensagem: str) -> list[str]:
    return [trecho for trecho, valor in valores_em_reais(mensagem) if valor not in PRECOS]


def _despedida_com_pergunta(r: Resposta) -> bool:
    return r.acao == "encaminhar_humano" and "?" in r.mensagem


def problemas(r: Resposta) -> list[str]:
    p = []
    if errados := precos_inventados(r.mensagem):
        p.append(f"Você citou {', '.join(errados)}, que não está na base. Use só os preços da base de conhecimento, "
                 "do jeito que estão lá; o que não estiver na base, o especialista confirma.")
    if _despedida_com_pergunta(r):
        p.append("A mensagem de encaminhamento é a despedida: tire toda pergunta dela, porque depois dela o bot sai da conversa.")
    if len(r.mensagem) > MAX_CARACTERES:
        p.append(f"A mensagem tem {len(r.mensagem)} caracteres e o máximo é {MAX_CARACTERES}: encurte, sem perder a pergunta.")
    return p


def agente(e: Estado) -> Estado:
    mensagens = [SystemMessage(SISTEMA), *map(_mensagem, e["historico"]), SystemMessage(_situacao(e))]
    if e.get("problemas"):
        correcao = " ".join(e["problemas"])
        mensagens += [AIMessage(e["resposta"].mensagem), SystemMessage(f"Reescreva a mensagem. {correcao}")]
    try:
        resposta, uso = chamar_llm(mensagens)
    except Exception:
        if not e.get("problemas"):
            raise
        # A reescrita falhou: fica a primeira resposta, e o conferir põe a fala segura no lugar dela.
        resposta, uso = e["resposta"], dict.fromkeys(e["uso"], 0)
    anterior = e.get("uso", {})
    return {
        "resposta": resposta,
        "uso": {k: anterior.get(k, 0) + v for k, v in uso.items()},
        "tentativas": e.get("tentativas", 0) + 1,
    }


# Regras que o prompt pede e o modelo às vezes esquece: aqui elas valem sempre.
def conferir(e: Estado) -> Estado:
    r = e["resposta"]
    p = problemas(r)
    if not p or e["tentativas"] < TENTATIVAS:
        return {"problemas": p}
    # Preço errado vira promessa comercial, e pergunta na despedida fica sem resposta: sai a fala segura.
    if precos_inventados(r.mensagem) or _despedida_com_pergunta(r):
        return {"problemas": [], "resposta": r.model_copy(update={"mensagem": FALA_SEGURA[r.acao]})}
    # Só passou do tamanho: longa ainda é melhor que nenhuma.
    return {"problemas": []}


def _depois_de_conferir(e: Estado) -> str:
    return "agente" if e["problemas"] else "qualificar"


def qualificar(e: Estado) -> Estado:
    lead = mesclar(e["lead"], e["resposta"].lead)
    score = pontuar(lead)
    return {"lead": lead, "score": score, "temperatura": temperatura(score), "etapa": etapa(lead)}


# Sem checkpointer: o estado da conversa mora no Postgres do web/, que o dashboard lê.
_grafo = (
    StateGraph(Estado)
    .add_node("agente", agente)
    .add_node("conferir", conferir)
    .add_node("qualificar", qualificar)
    .add_edge(START, "agente")
    .add_edge("agente", "conferir")
    .add_conditional_edges("conferir", _depois_de_conferir, ["agente", "qualificar"])
    .add_edge("qualificar", END)
    .compile()
)


def responder(historico: list[Turno], lead: Lead, msgs_bot: int, telefone_conhecido: bool) -> Estado:
    return _grafo.invoke(
        {"historico": historico, "lead": lead, "msgs_bot": msgs_bot, "telefone_conhecido": telefone_conhecido}
    )
