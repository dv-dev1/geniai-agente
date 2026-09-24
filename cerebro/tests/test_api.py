from fastapi.testclient import TestClient

import main
from agente.grafo import Resposta
from agente.lead import Lead

cliente = TestClient(main.app)
PEDIDO = {"historico": [{"autor": "cliente", "texto": "oi"}], "lead": {"nome": "Ana"}, "msgs_bot": 0}


def grafo_falso(historico, lead, msgs_bot, telefone_conhecido):
    return {
        "resposta": Resposta(mensagem="olá!", lead=Lead.vazio(), acao="continuar"),
        "lead": lead, "score": 5, "temperatura": "frio", "etapa": "triagem",
        "uso": {"entrada": 1, "cache": 0, "saida": 1},
    }


def test_sem_token_recusa(monkeypatch):
    monkeypatch.setenv("AGENTE_TOKEN", "segredo")
    assert cliente.post("/responder", json=PEDIDO).status_code == 401
    assert cliente.post("/responder", json=PEDIDO, headers={"Authorization": "Bearer errado"}).status_code == 401


def test_sem_token_configurado_fecha(monkeypatch):
    monkeypatch.delenv("AGENTE_TOKEN", raising=False)
    assert cliente.post("/responder", json=PEDIDO, headers={"Authorization": "Bearer "}).status_code == 401


def test_com_token_devolve_o_veredito(monkeypatch):
    monkeypatch.setenv("AGENTE_TOKEN", "segredo")
    monkeypatch.setattr(main, "responder", grafo_falso)
    r = cliente.post("/responder", json=PEDIDO, headers={"Authorization": "Bearer segredo"})
    assert r.status_code == 200
    assert r.json() | {"lead": None} == {
        "mensagem": "olá!", "acao": "continuar", "lead": None, "score": 5,
        "temperatura": "frio", "etapa": "triagem", "uso": {"entrada": 1, "cache": 0, "saida": 1},
    }
    assert r.json()["lead"]["nome"] == "Ana"


def test_sem_token_recusa_antes_de_validar_o_corpo(monkeypatch):
    monkeypatch.delenv("AGENTE_TOKEN", raising=False)
    assert cliente.post("/responder", json={}).status_code == 401


def test_header_fora_do_ascii_recusa_com_401(monkeypatch):
    monkeypatch.setenv("AGENTE_TOKEN", "segredo")
    r = cliente.post("/responder", json=PEDIDO, headers={"Authorization": "Bearer \xe7".encode("latin-1")})
    assert r.status_code == 401
