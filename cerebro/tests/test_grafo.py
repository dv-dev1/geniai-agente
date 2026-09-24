from agente import grafo
from agente.lead import Lead

USO = {"entrada": 10, "cache": 0, "saida": 5}


def llm_falso(capturado: dict, lead: Lead | None = None, acao: str = "continuar"):
    def chamar(mensagens):
        capturado["mensagens"] = mensagens
        return grafo.Resposta(mensagem="olá!", lead=lead or Lead.vazio(), acao=acao), USO
    return chamar


def test_grafo_mescla_com_o_que_ja_se_sabia_e_pontua(monkeypatch):
    novo = Lead.de_dict({"porte": "ME", "pediu_contato": True})
    monkeypatch.setattr(grafo, "chamar_llm", llm_falso({}, novo, "encaminhar_humano"))
    r = grafo.responder([{"autor": "cliente", "texto": "oi"}], Lead.de_dict({"nome": "Ana"}), 0, True)
    assert (r["lead"].nome, r["lead"].porte) == ("Ana", "ME")
    assert (r["score"], r["temperatura"], r["etapa"]) == (70, "quente", "encaminhado")
    assert r["resposta"].acao == "encaminhar_humano"
    assert r["uso"] == USO


def test_prompt_leva_base_papeis_e_estado(monkeypatch):
    capturado = {}
    monkeypatch.setattr(grafo, "chamar_llm", llm_falso(capturado))
    historico = [
        {"autor": "cliente", "texto": "oi"},
        {"autor": "bot", "texto": "Olá! Qual seu nome?"},
        {"autor": "humano", "texto": "Aqui é o Pedro"},
    ]
    grafo.responder(historico, Lead.vazio(), 3, False)
    m = capturado["mensagens"]
    assert "# Audiobot" in m[0].content and "# Disparador" in m[0].content
    assert [x.type for x in m[1:4]] == ["human", "ai", "ai"]
    assert m[3].content == "[atendente humano] Aqui é o Pedro"
    assert "3 de no máximo 7" in m[-1].content
    assert "telefone_conhecido: não" in m[-1].content


def test_base_ainda_cabe_inteira_no_prompt():
    # ~14k tokens. Acima disso a base inteira passa a pesar: hora de trocar por um nó de busca (RAG) no grafo.
    from agente.prompts import SISTEMA
    assert len(SISTEMA) < 50_000
