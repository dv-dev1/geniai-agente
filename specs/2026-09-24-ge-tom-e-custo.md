# ge-tom-e-custo

## Intenção

1. A Gê escreve como uma atendente humana no WhatsApp: mensagens curtas (até 300 caracteres), sem menu numerado ("1) Audiobot 2) Disparador"), e se apresenta só na primeira mensagem.
2. O dashboard mostra quanto as mensagens enviadas no mês custariam na API oficial do WhatsApp: cada mensagem da empresa (bot e atendente) × R$ 0,035, sem descontar a franquia, com a contagem ao lado.

## Critério de aceite

```bash
cd cerebro && uv run python -m agente.avaliar
# 6 personas "ok": ≤ 7 mensagens, temperatura esperada, toda mensagem do bot ≤ 300 caracteres e sem linha "1)" / "1."; exit 0
cd cerebro && uv run pytest && uv run ruff check .
cd web && npm run lint && npx tsc --noEmit
curl -s -u geniai:geniai localhost:3000/ | grep -o 'Custo simulado na API oficial[^<]*'
# Custo simulado na API oficial (mês) · N msgs × R$ 0,035
```

## Fora de escopo

- Botões e listas interativas da Z-API (instáveis).
- Quebrar a resposta em várias bolhas: cada bolha seria uma mensagem cobrada.
- Outras mudanças no dashboard, que vêm depois.
