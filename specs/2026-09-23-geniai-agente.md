# geniai-agente

## Intenção

1. Quem chama a GeniAI no WhatsApp é recebido pela **Gê**, a assistente virtual.
   - Ela faz a triagem: nome, empresa, segmento, porte MEI/ME/EPP/média/grande, colaboradores, dor principal e qual produto interessa.
   - Apresenta o produto que resolve aquela dor, com o preço real: **Audiobot** (gravação do ambiente com transcrição e relatórios) ou **Disparador** (disparo em massa pela API oficial do WhatsApp).
   - Leva o lead a falar com um especialista.
   - Fonte de tudo o que ela diz: `docs/respostas-geniai.md`. Sem emoji, sem cases, sem inventar.
2. O agente gasta o mínimo de mensagens: responde uma vez só a várias mensagens seguidas do cliente, manda uma mensagem por turno e chega ao encaminhamento em até 7 mensagens. Desde 01/10/2026 a Meta cobra R$ 0,035 por mensagem na API oficial, que é a que a GeniAI usa em produção.
3. Quando um atendente responde pelo celular, o bot sai da conversa por 24 h. Depois de encaminhar ou encerrar, também.
4. Um dashboard protegido por senha, com a identidade visual da GeniAI (tema escuro do site, gradiente do logo, fonte Inter), mostra o funil, a temperatura dos leads (quente, morno, frio), as mensagens do bot por conversa e o custo equivalente na API oficial. Nele o time abre a ficha e a conversa de cada lead e marca o status comercial.

## Critério de aceite

```bash
cd cerebro && uv run pytest && uv run ruff check .      # score/etapa do lead, grafo com LLM falso, rota exige token
cd cerebro && uv run python -m agente.avaliar
# 6 personas; cada linha "ok": ≤ 7 mensagens do bot e temperatura final = esperada; exit 0
cd web && npm test          # node:test: parse do webhook Z-API, debounce, dedupe, pausa humana, falha do cérebro
cd web && npm run lint && npx tsc --noEmit && npm run build
curl -s -o /dev/null -w '%{http_code}\n' https://geniai-web.vercel.app/                                   # 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://geniai-web.vercel.app/api/webhook/segredo-errado # 404
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://geniai-cerebro.vercel.app/responder -d '{}'       # 401
```

Manual, no WhatsApp real: mandar "oi", "tudo bem?" e "queria saber de automação" em menos de 6 s gera **exatamente 1** resposta, e o lead aparece em `/leads`.

## Fora de escopo

- Transcrição de áudio (o bot pede para o cliente escrever), leitura de imagem ou documento.
- Botões e listas interativas: a própria Z-API documenta que são instáveis, então as opções vão numeradas em texto.
- Follow-up e templates fora da janela de 24 h, notificação de lead quente, integração com CRM, rastreio de anúncio Click-to-WhatsApp.
- RAG ou banco vetorial: a base de conhecimento cabe inteira no prompt.
- MCP da Z-API no agente: ele só envia mensagens e colocaria uma chamada de ferramenta do LLM no meio de cada resposta. O `send-text` direto resolve.
- Plano pago da Vercel: o Hobby serve para o MVP e a demo. Uso comercial em produção pede Pro, ou a conta da própria GeniAI.

## Decisões

- **Canal:** Z-API (hospedada, sem VPS). O webhook dela não é assinado, então o segredo vai no caminho da URL.
- **Monorepo com dois projetos na Vercel:**
  - `web/` em Next.js 16: webhook, debounce com `after()`, Postgres Neon e dashboard.
  - `cerebro/` em Python com FastAPI e LangGraph: o agente.
  - O debounce fica no Next porque a Vercel não tem `waitUntil` para Python.
  - O cérebro é sem estado: recebe o histórico e o lead e devolve `{mensagem, lead, score, temperatura, etapa, acao}`.
  - A rota do cérebro exige `Authorization: Bearer <AGENTE_TOKEN>`.
- **LangGraph sem checkpointer.** O estado mora no Postgres, que o dashboard lê. O grafo é `agente → qualificar`: o nó `agente` chama o LLM e o nó `qualificar` mescla e pontua em código. Ferramentas como agenda e CRM entram como nós novos quando existirem.
- **LLM:** `gpt-4.1-mini` via `langchain-openai`, uma chamada por turno com saída estruturada (`json_schema` strict).
- **Estrutura pública:**
  - `cerebro/pyproject.toml` com build-system, `requires-python >=3.11`, licença, extra `dev`, `[tool.ruff]` e CI em Python 3.11 e 3.12.
  - `web/package.json` com `engines`, Biome e CI em Node 22 e 24.
  - `LICENSE` MIT e README com a saída real.
- **Base de conhecimento** em `cerebro/kb/*.md`, lida inteira pelo prompt. As perguntas para a GeniAI estão em `docs/perguntas-para-geniai.md`, fora de `kb/` para não entrarem no prompt.
