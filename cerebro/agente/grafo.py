import os
import re
from functools import cache
from typing import Literal

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel
from typing_extensions import TypedDict

from .lead import Etapa, Lead, Temperatura, etapa, mesclar, pontuar, temperatura
from .prompts import MAX_CARACTERES, MAX_MENSAGENS_BOT, PRECOS, SISTEMA


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
    score: int
    temperatura: Temperatura
    etapa: Etapa


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
FALA_SEGURA = "Esse valor o especialista da GeniAI confirma com você. Quer que eu passe seu contato para ele?"
DESPEDIDA = "Obrigada! Vou passar sua conversa para um especialista da GeniAI, que responde das 8h às 17h."
_VALOR = re.compile(r"R\$\s*(\d[\d.]*\d|\d)(?:,(\d+))?")


def precos_inventados(mensagem: str) -> list[str]:
    return [
        m.group(0)
        for m in _VALOR.finditer(mensagem)
        if int(m.group(1).replace(".", "")) not in PRECOS or (m.group(2) or "").strip("0")
    ]


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
    if "resposta" in e:
        correcao = " ".join(problemas(e["resposta"]))
        mensagens += [AIMessage(e["resposta"].mensagem), SystemMessage(f"Reescreva a mensagem. {correcao}")]
    resposta, uso = chamar_llm(mensagens)
    anterior = e.get("uso", {})
    return {
        "resposta": resposta,
        "uso": {k: anterior.get(k, 0) + v for k, v in uso.items()},
        "tentativas": e.get("tentativas", 0) + 1,
    }


# Regras que o prompt pede e o modelo às vezes esquece: aqui elas valem sempre.
def conferir(e: Estado) -> Estado:
    r = e["resposta"]
    if e["tentativas"] < TENTATIVAS:
        return {}
    # Preço errado no WhatsApp vira promessa comercial.
    if precos_inventados(r.mensagem):
        return {"resposta": r.model_copy(update={"mensagem": FALA_SEGURA, "acao": "continuar"})}
    if _despedida_com_pergunta(r):
        return {"resposta": r.model_copy(update={"mensagem": DESPEDIDA})}
    # Só passou do tamanho: longa ainda é melhor que nenhuma.
    return {}


def _depois_de_conferir(e: Estado) -> str:
    return "agente" if e["tentativas"] < TENTATIVAS and problemas(e["resposta"]) else "qualificar"


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
