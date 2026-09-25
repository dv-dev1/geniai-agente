# dashboard-v2

## Intenção

1. O dashboard fala a língua do time comercial. Temperatura vira **Prioridade** (Alta, Média, Baixa) e score vira **Pontuação** (0 a 100). Etapas e status aparecem com nomes legíveis e maiúsculas: Primeiro contato, Identificado, Necessidade mapeada, Produto apresentado, Com especialista, Fora do perfil; A contatar, Em contato, Reunião agendada, Venda fechada, Perdido. As chaves no banco não mudam.
2. A visão geral tem título com estilo e mostra coisas diferentes:
   - um funil acumulado com a % de conversão entre etapas;
   - uma rosca de prioridade;
   - novos leads por dia, com balão de quantidade no hover e barras que crescem ao abrir.
3. A lista filtra por chips, sem botão "Filtrar", e mostra produto, prioridade com pontuação, etapa, status e última atividade.
4. A ficha do lead traz:
   - o resumo da conversa escrito pela Gê;
   - as informações coletadas agrupadas, com medidor "N de 8";
   - o status comercial em pílulas que salvam no clique.
5. A Gê preenche um `resumo` a cada turno e, antes de oferecer o especialista, garante nome, empresa, tamanho, necessidade e produto. `segmento` sai do lead: ela nunca perguntava.

## Critério de aceite

```bash
cd web && npm test && npm run lint && npx tsc --noEmit && npm run build   # rotulos.test: funil acumulado e %
cd cerebro && uv run pytest && uv run ruff check .
cd cerebro && uv run python -m agente.avaliar   # 6/6 ok; persona encaminhada chega com nome, empresa, dor, servicos e resumo
curl -su geniai:geniai localhost:3000/ | grep -c 'Prioridade alta'                            # > 0
curl -su geniai:geniai localhost:3000/leads | grep -o '>A contatar<\|>a_contatar<\|>quente<' | sort -u   # só ">A contatar<"
```

## Fora de escopo

- Dados de demonstração no Neon: pedido futuro, e exige um banco ou branch separado.
- Renomear chaves no banco ou no cérebro.
- Resumo sob demanda para conversas antigas.
- Biblioteca de gráficos.
- Notificação de lead.
