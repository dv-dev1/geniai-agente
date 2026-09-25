import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from langchain_openai import ChatOpenAI

from .grafo import Turno, responder
from .lead import Lead
from .prompts import MAX_CARACTERES, MAX_MENSAGENS_BOT

PRECO_USD_POR_MILHAO = {"entrada": 0.40, "cache": 0.10, "saida": 1.60}
MENU = re.compile(r"^\s*\d+[).]", re.MULTILINE)


@dataclass
class Persona:
    nome: str
    esperado: str
    perfil: str


PERSONAS = [
    Persona("MEI curiosa", "frio", "Você é a Carla, manicure, MEI, trabalha sozinha. Viu um post da GeniAI e ficou curiosa, mas não tem um problema específico nem quer contratar nada (se perguntarem o que precisa, diz que nada por enquanto), não tem pressa e não quer falar com especialista agora (\"vou pensar\")."),
    Persona("Restaurante", "quente", "Você é o Marcos, dono de um restaurante em Recife (ME, 12 funcionários). Não sabe o que acontece na cozinha quando não está lá e quer acompanhar umas 8 horas por dia. Quer começar no mês que vem e quer falar com um especialista."),
    Persona("Gerente de varejo", "morno", "Você é a Paula, gerente de marketing de uma rede de lojas média (80 funcionários). Hoje avisa os clientes das promoções um a um no WhatsApp. Não sabe quantos contatos tem na base, não decide sozinha, depende da diretoria, não tem pressa e agora não quer marcar conversa: prefere pensar."),
    Persona("Candidato a vaga", "frio", "Você é o Lucas, desenvolvedor, e quer saber se a GeniAI está contratando. Você não é cliente."),
    Persona("Só quer preço", "quente", "Você é a Renata, sócia de uma clínica odontológica (EPP, 20 funcionários). Quer gravar o atendimento da recepção e insiste em saber quanto custa antes de qualquer coisa. Depois de saber o preço, aceita falar com um especialista."),
    Persona("Distribuidora decidida", "quente", "Você é o Roberto, diretor de uma distribuidora de bebidas (grande, 300 funcionários). Tem uma base de uns 50 mil clientes e quer mandar avisos e promoções para todos pelo WhatsApp. Quer começar já e pede logo uma reunião."),
]


def despedida(fala: str) -> bool:
    # Depois do encaminhamento o bot pausa: uma pergunta ali fica sem resposta.
    return "especialista" in fala.lower() and "?" not in fala


def fala_do_cliente(p: Persona, historico: list[Turno]) -> str:
    llm = ChatOpenAI(model=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"), temperature=0.7, max_tokens=200)
    mensagens = [("system", (
        f"Você faz o papel de um cliente no WhatsApp para testar um atendimento. {p.perfil}\n"
        "Escreva só a próxima mensagem do cliente: curta e informal. Responda ao que foi "
        "perguntado sem entregar tudo de uma vez."
    ))]
    mensagens += [("assistant" if t["autor"] == "cliente" else "user", t["texto"]) for t in historico]
    if not historico:
        mensagens.append(("user", "(o atendimento ainda não começou: mande a primeira mensagem)"))
    return str(llm.invoke(mensagens).content).strip() or "oi"


def conversar(p: Persona) -> dict:
    historico: list[Turno] = []
    lead, msgs_bot, acao = Lead.vazio(), 0, "continuar"
    uso = {"entrada": 0, "cache": 0, "saida": 0}
    while acao == "continuar" and msgs_bot < MAX_MENSAGENS_BOT + 3:
        historico.append({"autor": "cliente", "texto": fala_do_cliente(p, historico)})
        r = responder(historico, lead, msgs_bot, True)
        historico.append({"autor": "bot", "texto": r["resposta"].mensagem})
        lead, msgs_bot, acao = r["lead"], msgs_bot + 1, r["resposta"].acao
        uso = {k: uso[k] + r["uso"][k] for k in uso}
        temp = r["temperatura"]
    custo = ((uso["entrada"] - uso["cache"]) * PRECO_USD_POR_MILHAO["entrada"]
             + uso["cache"] * PRECO_USD_POR_MILHAO["cache"] + uso["saida"] * PRECO_USD_POR_MILHAO["saida"]) / 1e6
    falas = [t["texto"] for t in historico if t["autor"] == "bot"]
    ok = (msgs_bot <= MAX_MENSAGENS_BOT and temp == p.esperado and acao != "continuar"
          and all(len(f) <= MAX_CARACTERES and not MENU.search(f) for f in falas)
          and (acao != "encaminhar_humano" or despedida(falas[-1])))
    return {"p": p, "msgs": msgs_bot, "temp": temp, "acao": acao, "custo": custo, "ok": ok, "historico": historico}


def main() -> int:
    with ThreadPoolExecutor() as pool:
        resultados = list(pool.map(conversar, PERSONAS))
    print(f"{'persona':22}{'msgs':6}{'temperatura':18}{'acao':20}custo US$")
    for r in resultados:
        temp = f"{r['temp']} ({r['p'].esperado})"
        print(f"{r['p'].nome:22}{r['msgs']:<6}{temp:18}{r['acao']:20}{r['custo']:.4f}  {'ok' if r['ok'] else 'FALHOU'}")
    for r in (r for r in resultados if "--mostrar" in sys.argv or not r["ok"]):
        print(f"\n## {r['p'].nome}")
        for t in r["historico"]:
            print(f"{'cliente' if t['autor'] == 'cliente' else 'bot    '}> {t['texto']}")
    total = sum(r["custo"] for r in resultados)
    print(f"\ncusto total US$ {total:.4f} · média por conversa US$ {total / len(resultados):.4f}")
    return 0 if all(r["ok"] for r in resultados) else 1


if __name__ == "__main__":
    sys.exit(main())
