import os
import secrets

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

from agente.audio import transcrever
from agente.grafo import Turno, responder
from agente.lead import Lead

app = FastAPI(title="GeniAI · cérebro")


class Pedido(BaseModel):
    historico: list[Turno]
    lead: dict = {}
    msgs_bot: int = 0
    telefone_conhecido: bool = True


def exigir_token(authorization: str = Header(default="")) -> None:
    token = os.environ.get("AGENTE_TOKEN", "")
    # Rota pública na Vercel: sem o token, qualquer um gastaria o crédito da OpenAI.
    # Em bytes porque compare_digest recusa str não-ASCII, e o header pode chegar em latin-1.
    if not token or not secrets.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
        raise HTTPException(status_code=401)


# O web chama esta rota enquanto espera o cliente parar de digitar: a partida a frio corre junto com a espera.
@app.get("/saude")
def saude() -> dict:
    return {"ok": True}


# Como dependência, o token é checado antes da validação do corpo: sem token, 401 e não 422.
@app.post("/responder", dependencies=[Depends(exigir_token)])
def rota_responder(pedido: Pedido) -> dict:
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


class PedidoAudio(BaseModel):
    url: str
    segundos: int = 0


@app.post("/transcrever", dependencies=[Depends(exigir_token)])
def rota_transcrever(pedido: PedidoAudio) -> dict:
    return transcrever(pedido.url, pedido.segundos)
