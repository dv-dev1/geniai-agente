from agente.lead import Lead, etapa, mesclar, pontuar, temperatura


def lead(**campos) -> Lead:
    return Lead.de_dict(campos)


def test_restaurante_com_dor_produto_urgencia_e_decisor_e_quente():
    l = lead(porte="ME", colaboradores=12, dor="não sabe o que acontece na cozinha", servicos=["audiobot"],
             urgencia="ate_3_meses", decisor=True)
    assert pontuar(l) == 70
    assert temperatura(70) == "quente"


def test_mei_sozinho_com_dor_vaga_e_frio():
    assert pontuar(lead(porte="MEI", colaboradores=1, dor="quero entender IA")) == 25
    assert temperatura(25) == "frio"


def test_media_sem_pressa_sem_decisor_e_sem_base_conhecida_fica_morna():
    l = lead(porte="media", colaboradores=80, dor="avisa os clientes um a um", servicos=["disparador"],
             urgencia="sem_pressa", decisor=False)
    assert pontuar(l) == 55
    assert temperatura(55) == "morno"


def test_plano_escolhido_conta_como_intencao_concreta():
    assert pontuar(lead(servicos=["audiobot"], plano="padrao")) == 30


def test_base_grande_de_contatos_conta_como_intencao_concreta():
    assert pontuar(lead(servicos=["disparador"], base_clientes=5000)) == 30
    assert pontuar(lead(servicos=["disparador"], base_clientes=100)) == 15


def test_pedido_de_contato_vira_quente_mesmo_com_pouca_informacao():
    assert pontuar(lead(porte="MEI", pediu_contato=True)) == 70


def test_lead_completo_chega_a_95():
    l = lead(porte="grande", colaboradores=300, dor="x", servicos=["audiobot"], plano="premium",
             urgencia="imediata", decisor=True)
    assert pontuar(l) == 95


def test_fora_do_perfil_zera_e_vai_para_perdido():
    l = lead(porte="grande", fora_do_perfil=True)
    assert pontuar(l) == 0
    assert etapa(l) == "perdido"


def test_etapa_acompanha_o_que_ja_se_sabe():
    assert etapa(Lead.vazio()) == "novo"
    assert etapa(lead(nome="Ana")) == "triagem"
    assert etapa(lead(nome="Ana", dor="x")) == "apresentacao"
    assert etapa(lead(dor="x", servicos=["audiobot"])) == "interesse"
    assert etapa(lead(servicos=["audiobot"], pediu_contato=True)) == "encaminhado"


def test_none_do_modelo_nao_apaga_campo_conhecido():
    m = mesclar(lead(nome="Ana", porte="ME"), lead(dor="estoque"))
    assert (m.nome, m.porte, m.dor) == ("Ana", "ME", "estoque")


def test_servicos_acumulam_sem_repetir():
    m = mesclar(lead(servicos=["audiobot"]), lead(servicos=["audiobot", "disparador"]))
    assert m.servicos == ["audiobot", "disparador"]


def test_pedido_de_contato_nao_volta_atras():
    assert mesclar(lead(pediu_contato=True), lead(pediu_contato=False)).pediu_contato is True


def test_de_dict_ignora_chave_desconhecida_do_banco():
    assert Lead.de_dict({"nome": "Ana", "orcamento": "ate_10k"}).nome == "Ana"


def test_false_conhecido_de_pediu_contato_nao_vira_none():
    assert mesclar(lead(pediu_contato=False), Lead.vazio()).pediu_contato is False
