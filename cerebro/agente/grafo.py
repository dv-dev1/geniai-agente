import os
from functools import cache
from typing import Literal

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel
from typing_extensions import TypedDict

from .lead import Etapa, Lead, Temperatura, etapa, mesclar, pontuar, temperatura
from .prompts import MAX_MENSAGENS_BOT, SISTEMA


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


def agente(e: Estado) -> Estado:
    resposta, uso = chamar_llm([SystemMessage(SISTEMA), *map(_mensagem, e["historico"]), SystemMessage(_situacao(e))])
    return {"resposta": resposta, "uso": uso}


def qualificar(e: Estado) -> Estado:
    lead = mesclar(e["lead"], e["resposta"].lead)
    score = pontuar(lead)
    return {"lead": lead, "score": score, "temperatura": temperatura(score), "etapa": etapa(lead)}


# Sem checkpointer: o estado da conversa mora no Postgres do web/, que o dashboard lê.
_grafo = (
    StateGraph(Estado)
    .add_node("agente", agente)
    .add_node("qualificar", qualificar)
    .add_edge(START, "agente")
    .add_edge("agente", "qualificar")
    .add_edge("qualificar", END)
    .compile()
)


def responder(historico: list[Turno], lead: Lead, msgs_bot: int, telefone_conhecido: bool) -> Estado:
    return _grafo.invoke(
        {"historico": historico, "lead": lead, "msgs_bot": msgs_bot, "telefone_conhecido": telefone_conhecido}
    )
