from .grafo import Turno, responder
from .lead import Lead


def main() -> None:
    historico: list[Turno] = []
    lead, msgs_bot = Lead.vazio(), 0
    while texto := input("\nvocê> ").strip():
        historico.append({"autor": "cliente", "texto": texto})
        r = responder(historico, lead, msgs_bot, True)
        historico.append({"autor": "bot", "texto": r["resposta"].mensagem})
        lead, msgs_bot = r["lead"], msgs_bot + 1
        print(f"\nbot> {r['resposta'].mensagem}")
        print(f"     [{r['resposta'].acao} · {r['etapa']} · {r['temperatura']} {r['score']} · {msgs_bot} msgs]")
        if r["resposta"].acao != "continuar":
            break


if __name__ == "__main__":
    main()
