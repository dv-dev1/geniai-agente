import os
import secrets

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from agente.grafo import Turno, responder
from agente.lead import Lead

app = FastAPI(title="GeniAI · cérebro")


class Pedido(BaseModel):
    historico: list[Turno]
    lead: dict = {}
    msgs_bot: int = 0
    telefone_conhecido: bool = True


@app.post("/responder")
def rota_responder(pedido: Pedido, authorization: str = Header(default="")) -> dict:
    token = os.environ.get("AGENTE_TOKEN", "")
    # Rota pública na Vercel: sem o token, qualquer um gastaria o crédito da OpenAI.
    if not token or not secrets.compare_digest(authorization, f"Bearer {token}"):
        raise HTTPException(status_code=401)
    r = responder(pedido.historico, Lead.de_dict(pedido.lead), pedido.msgs_bot, pedido.telefone_conhecido)
    return {
        "mensagem": r["resposta"].mensagem,
        "acao": r["resposta"].acao,
        "lead": r["lead"].model_dump(),
        "score": r["score"],
        "temperatura": r["temperatura"],
        "etapa": r["etapa"],
        "uso": r["uso"],
    }
