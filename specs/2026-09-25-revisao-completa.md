# revisao-completa

## Intenção

Corrigir o que a revisão completa (code review high + percurso no navegador) achou, antes do merge na `main`:

1. Segurança:
   - redirecionamento aberto depois do login (`/login?de=/%09/evil.com`);
   - server action gravando sem checar a sessão;
   - segredo do webhook comparado sem tempo constante;
   - sessão vencida quebrando os botões de status e "Sair".
2. Fluxo do bot:
   - falha do cérebro e encaminhamento sem `pediu_contato` passam a aparecer como "Com especialista";
   - mensagens trocadas com o atendente durante a pausa não voltam para o bot;
   - o lead qualificado é salvo mesmo se o envio pela Z-API falhar.
3. Painel:
   - wa.me com o 55 e telefone formatado;
   - `*negrito*` renderizado na conversa;
   - 404 em português;
   - "← Leads" na ficha;
   - menu marca a página atual e as abas têm título por página;
   - ficha com as consultas em paralelo;
   - celular sem rolagem horizontal.

## Critério de aceite

```bash
cd web && npm test && npm run lint && npx tsc --noEmit && npm run build
# fluxo.test: falha do cérebro e encaminhar sem pediu_contato viram encaminhado; pausa não reaproveita mensagens; lead salvo com a Z-API fora
# sessao.test: destinoSeguro recusa "/\t/evil.com" e "/\n/evil.com"
# abordagem.test: wa.me com 55, telefone formatado, *negrito*
```

No navegador (`playwright-cli`), conferir quatro coisas:

- `/login?de=/%09/evil.com` fica em localhost;
- com sessão inválida, o clique no status leva ao login e não grava;
- `/leads/nao-existe` mostra o 404 em português;
- 390 px de largura sem rolagem horizontal em `/`, `/leads` e na ficha.

## Fora de escopo

- Reenfileirar a mensagem quando o send-text da Z-API falhar (segue o `ponytail:` no `fluxo.ts`).
- Paginação da lista de leads (limite de 200).
