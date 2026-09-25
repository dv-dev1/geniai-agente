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


def llm_em_sequencia(falas: list[str], acao: str):
    chamadas = []

    def chamar(mensagens):
        chamadas.append(mensagens)
        fala = falas[min(len(chamadas), len(falas)) - 1]
        return grafo.Resposta(mensagem=fala, lead=Lead.vazio(), acao=acao), USO
    return chamar, chamadas


def responder_com(monkeypatch, falas: list[str], acao: str = "continuar"):
    chamar, chamadas = llm_em_sequencia(falas, acao)
    monkeypatch.setattr(grafo, "chamar_llm", chamar)
    return grafo.responder([{"autor": "cliente", "texto": "quanto custa?"}], Lead.vazio(), 2, True), chamadas


def test_precos_da_base_passam_e_os_de_fora_nao():
    assert grafo.precos_inventados("O Padrão sai por *R$ 399,00*, o Inicial por R$299.") == []
    assert grafo.precos_inventados("R$ 999 de implementação mais R$ 499 por mês.") == []
    assert grafo.precos_inventados("Com ponto decimal: R$ 399.00.") == []
    assert grafo.precos_inventados("Fica R$ 199 ou R$ 299,90.") == ["R$ 199", "R$ 299,90"]
    # A soma do primeiro mês do Disparador está na base; uma soma que a base não tem é preço inventado.
    assert grafo.precos_inventados("No total, R$ 1.498 no primeiro mês.") == []
    assert grafo.precos_inventados("Os dois juntos dão R$ 1.298.") == ["R$ 1.298"]


def test_preco_da_base_passa_de_primeira(monkeypatch):
    r, chamadas = responder_com(monkeypatch, ["O Padrão sai por *R$ 399*. Quantas horas por dia?"])
    assert len(chamadas) == 1
    assert r["resposta"].mensagem.startswith("O Padrão")


def test_preco_inventado_faz_a_ge_reescrever_uma_vez(monkeypatch):
    r, chamadas = responder_com(monkeypatch, ["Sai por R$ 199.", "Sai por R$ 299."])
    assert r["resposta"].mensagem == "Sai por R$ 299."
    assert len(chamadas) == 2
    assert "R$ 199" in chamadas[1][-1].content
    assert r["uso"] == {k: 2 * v for k, v in USO.items()}


def test_preco_inventado_duas_vezes_vira_fala_segura(monkeypatch):
    r, chamadas = responder_com(monkeypatch, ["Sai por R$ 199.", "Sai por R$ 1.298."])
    assert len(chamadas) == 2
    assert (r["resposta"].mensagem, r["resposta"].acao) == (grafo.FALA_SEGURA["continuar"], "continuar")


def test_fala_segura_nao_desfaz_o_encaminhamento(monkeypatch):
    r, _ = responder_com(monkeypatch, ["Te passo, custa R$ 199.", "Te passo, custa R$ 199."], "encaminhar_humano")
    assert (r["resposta"].mensagem, r["resposta"].acao) == (grafo.FALA_SEGURA["encaminhar_humano"], "encaminhar_humano")


def test_despedida_com_pergunta_e_reescrita(monkeypatch):
    falas = ["Você é quem decide? Vou passar para o especialista.", "Obrigada, Roberto! Vou passar para o especialista."]
    r, chamadas = responder_com(monkeypatch, falas, "encaminhar_humano")
    assert len(chamadas) == 2
    assert "tire toda pergunta" in chamadas[1][-1].content
    assert r["resposta"].mensagem == falas[1]


def test_despedida_com_pergunta_duas_vezes_vira_despedida_fixa(monkeypatch):
    r, _ = responder_com(monkeypatch, ["Posso passar?", "Tudo certo?"], "encaminhar_humano")
    assert (r["resposta"].mensagem, r["resposta"].acao) == (grafo.FALA_SEGURA["encaminhar_humano"], "encaminhar_humano")


def test_pergunta_fora_da_despedida_e_normal(monkeypatch):
    _, chamadas = responder_com(monkeypatch, ["Qual o nome da empresa?"])
    assert len(chamadas) == 1


def test_mensagem_longa_e_encurtada_e_depois_de_duas_tentativas_passa_como_esta(monkeypatch):
    longa = "x" * 350
    r, chamadas = responder_com(monkeypatch, [longa, "curta?"])
    assert (len(chamadas), r["resposta"].mensagem) == (2, "curta?")
    r, chamadas = responder_com(monkeypatch, [longa, longa])
    assert (len(chamadas), r["resposta"].mensagem) == (2, longa)


def test_custo_desconta_o_cache_da_entrada():
    uso = {"entrada": 1_000_000, "cache": 500_000, "saida": 1_000_000}
    assert grafo.custo_usd(uso) == 0.5 * 0.40 + 0.5 * 0.10 + 1.60


def test_reescrita_que_falha_fica_com_a_fala_segura(monkeypatch):
    chamadas = []

    def chamar(mensagens):
        chamadas.append(mensagens)
        if len(chamadas) > 1:
            raise RuntimeError("sem resposta estruturada")
        return grafo.Resposta(mensagem="Sai por R$ 199.", lead=Lead.vazio(), acao="continuar"), USO
    monkeypatch.setattr(grafo, "chamar_llm", chamar)
    r = grafo.responder([{"autor": "cliente", "texto": "quanto custa?"}], Lead.vazio(), 2, True)
    assert len(chamadas) == 2
    assert r["resposta"].mensagem == grafo.FALA_SEGURA["continuar"]
    assert r["uso"] == USO


def test_fala_segura_tira_so_a_frase_do_preco_e_guarda_a_pergunta(monkeypatch):
    fala = "Ótimo! O Padrão sai por R$ 199. Qual a cidade da clínica?"
    r, _ = responder_com(monkeypatch, [fala, fala])
    assert r["resposta"].mensagem == "Ótimo! O valor exato o especialista da GeniAI confirma com você. Qual a cidade da clínica?"
