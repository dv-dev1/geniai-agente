from typing import Literal

from pydantic import BaseModel

Servico = Literal["audiobot", "disparador"]
Etapa = Literal["novo", "triagem", "apresentacao", "interesse", "encaminhado", "perdido"]
Temperatura = Literal["quente", "morno", "frio"]

PONTOS_PORTE = {"MEI": 5, "ME": 10, "EPP": 15, "media": 15, "grande": 15}
PONTOS_URGENCIA = {"imediata": 15, "ate_3_meses": 10, "sem_pressa": 0}
# ponytail: corte arbitrário para "base que justifica o Disparador"; calibrar com a GeniAI.
BASE_RELEVANTE = 500


class Lead(BaseModel):
    # Sem default de propósito: o structured output strict da OpenAI exige todo campo presente.
    nome: str | None
    empresa: str | None
    cidade: str | None
    porte: Literal["MEI", "ME", "EPP", "media", "grande"] | None
    colaboradores: int | None
    dor: str | None
    servicos: list[Servico]
    plano: Literal["inicial", "padrao", "premium"] | None
    base_clientes: int | None
    urgencia: Literal["imediata", "ate_3_meses", "sem_pressa"] | None
    decisor: bool | None
    telefone: str | None
    pediu_contato: bool | None
    fora_do_perfil: bool | None
    resumo: str | None

    @classmethod
    def vazio(cls) -> "Lead":
        return cls.model_validate({campo: [] if campo == "servicos" else None for campo in cls.model_fields})

    @classmethod
    def de_dict(cls, dados: dict) -> "Lead":
        conhecidos = {k: v for k, v in dados.items() if k in cls.model_fields}
        return cls.model_validate(cls.vazio().model_dump() | conhecidos)


def mesclar(atual: Lead, novo: Lead) -> Lead:
    # O modelo devolve None para o que não ouviu neste turno; None nunca apaga o que já se sabia.
    dados = atual.model_dump() | {k: v for k, v in novo.model_dump().items() if v is not None}
    dados["servicos"] = list(dict.fromkeys(atual.servicos + novo.servicos))
    # Pedido de contato não volta atrás; um False já conhecido também não vira None.
    if atual.pediu_contato or novo.pediu_contato:
        dados["pediu_contato"] = True
    return Lead.model_validate(dados)


def pontuar(lead: Lead) -> int:
    if lead.fora_do_perfil:
        return 0
    s = 0
    if lead.porte:
        s += PONTOS_PORTE[lead.porte]
    elif lead.colaboradores is not None:
        # Quem diz "80 funcionários" raramente diz o porte; faixas do Sebrae para comércio e serviços.
        s += PONTOS_PORTE["ME" if lead.colaboradores < 10 else "EPP"]
    if lead.colaboradores is not None:
        s += 10 if lead.colaboradores >= 10 else 5
    if lead.dor:
        s += 15
    if lead.servicos:
        s += 15
    if lead.plano or (lead.base_clientes or 0) >= BASE_RELEVANTE:
        s += 15
    if lead.urgencia:
        s += PONTOS_URGENCIA[lead.urgencia]
    if lead.decisor:
        s += 10
    if lead.pediu_contato:
        s = max(s, 70)
    return s


def temperatura(score: int) -> Temperatura:
    return "quente" if score >= 70 else "morno" if score >= 40 else "frio"


def etapa(lead: Lead) -> Etapa:
    if lead.fora_do_perfil:
        return "perdido"
    if lead.pediu_contato:
        return "encaminhado"
    if lead.servicos:
        return "interesse"
    if lead.dor:
        return "apresentacao"
    if lead.nome or lead.empresa or lead.porte or lead.colaboradores is not None:
        return "triagem"
    return "novo"
