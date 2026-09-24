# geniai-agente — plano de implementação (híbrido Python + Next)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** agente de pré-vendas da GeniAI no WhatsApp (Z-API) que faz a triagem, apresenta os serviços e encaminha os leads, mais um dashboard de leads com a identidade visual da GeniAI.

**Architecture:** monorepo com dois projetos na Vercel.
- `web/` (Next.js 16) recebe o webhook da Z-API em `POST /api/webhook/<segredo>` e grava a mensagem no Postgres (Neon). Com `after()`, espera 6 s de silêncio do contato e reivindica as mensagens pendentes. Chama o cérebro, responde por `send-text` e grava o veredito. Também serve o dashboard, atrás de basic auth.
- `cerebro/` (FastAPI + LangGraph) é sem estado. `POST /responder` recebe o histórico e o lead e roda o grafo `agente → qualificar`: uma chamada ao `gpt-4.1-mini` com saída estruturada, depois o merge e o score em código. Devolve `{mensagem, acao, lead, score, temperatura, etapa, uso}`.

**Tech Stack:**
- `cerebro/`: Python 3.12, `langgraph` 1.2, `langchain-openai` 1.6, FastAPI 0.141, pydantic 2, pytest, ruff, uv.
- `web/`: Next.js 16.3, TypeScript, Tailwind 4, Biome 2.5, `@neondatabase/serverless` 1.x, `node:test` com type stripping (Node ≥ 22.18).

**Spec:** `specs/2026-09-23-geniai-agente.md` · **Marca:** `docs/marca/geniai-icone.png`, `docs/marca/site-hero.png`

## Global Constraints

- Python `>=3.11` (`.python-version` 3.12). Ruff `line-length = 110`. Imports dentro de `agente/` são relativos (`from .lead import Lead`).
- Node `>=22.18`; `web/package.json` com `"type": "module"`, `"license": "MIT"`.
- `web/`: o Biome está configurado com aspas simples, sem ponto e vírgula e linha de 120; `npx biome format --write` antes do `npm run lint`. O `tsc` precisa de `npx next typegen` antes (gera `LayoutProps` e os tipos de rota); o CI já faz isso.
- `cerebro/`: o `uv.lock` é versionado e é por ele que a Vercel instala.
- **TS: import relativo entre `.ts` leva a extensão** (`./zapi.ts`); no `app/` use `@/lib/x.ts`. Tipos sempre com `import type` / `{ type X }`. `tsconfig`: `allowImportingTsExtensions: true`, `verbatimModuleSyntax: true`. Sem `enum`, `namespace` nem parameter properties.
- Modelo: `os.environ.get('OPENAI_MODEL', 'gpt-4.1-mini')`.
- `MAX_MENSAGENS_BOT = 7`; `DEBOUNCE_MS` padrão `6000`; pausa de `24` h depois que um humano fala, que o bot encaminha, que encerra ou que o cérebro falha.
- Custo Meta: `R$ 0,035` por mensagem da empresa, `1000` grátis por mês.
- Nenhum módulo abre conexão, lê segredo ou instancia cliente de LLM no import. `next build` e o pytest importam tudo sem env.
- O cérebro exige `Authorization: Bearer <AGENTE_TOKEN>`. Sem token configurado, recusa tudo.
- Comentário só para explicar por quê (regra do manual): nada de banner, nada de docstring que repita o nome.
- Textos para o cliente em pt-BR. Identificadores em português, como nesta spec.
- **O que a Gê diz vem de `docs/respostas-geniai.md`** (respostas da GeniAI de 24/09/2026). Produtos: **Audiobot** e **Disparador**, com os preços de lá. Os cases e números do site são fictícios e nunca aparecem. **Nenhum emoji** em texto para o cliente, nem nas mensagens fixas do código.
- **Identidade visual** (tirada do site em 24/09/2026):

| Token | Valor | Origem |
|---|---|---|
| fundo | `#010f17` | `body` do site |
| superfície | `rgb(255 255 255 / .05)`, borda `rgb(255 255 255 / .10)` | cartões do site |
| texto | `#d9d9d9` (títulos), `#ffffff` (corpo) | h2 e parágrafos |
| texto suave | `rgb(163 191 255 / .62)` | legendas |
| botão principal | `linear-gradient(96deg, #0069ab 0%, #07afb5 150%)`, raio `100px` | "Agendar diagnóstico" |
| gradiente da marca | `#0daadf → #08fbd0` | ícone do logo |
| destaque | `#0099ff`, `#00c0fa` | links e brilhos |
| fonte | Inter 400/500; títulos grandes com `letter-spacing: -0.066em` | h2 72px / -4.8px |
| raio | cartões 16–20px, botões em pílula | CSS do site |

## Review Focus

1. **Contato só com `@lid`.** O cérebro recebe `telefone_conhecido: false` e pede um número no encaminhamento. Um `@lid` que chegar depois nunca sobrescreve um telefone real. Testes nas Tarefas 3 e 7.
2. **Reentrega do mesmo webhook pela Z-API** (mesmo `messageId`). Não pode sair segunda resposta. Teste na Tarefa 7.
3. **Áudio, figurinha, imagem com legenda.** Áudio vira `[áudio]` e o bot pede texto. Figurinha é ignorada. A legenda da imagem conta como texto. Teste na Tarefa 6.
4. **Cérebro fora do ar** (partida a frio, timeout, 401, 500, resposta sem `parsed`). O cliente recebe `FALHA`, o contato pausa e nada trava. Testes nas Tarefas 4 e 7.
5. **Corpo do webhook inválido ou de outro tipo** (`null`, `MessageStatusCallback`, grupo, newsletter). Vira `ignorar`, sem exceção. Teste na Tarefa 6.

---

### Task 1: esqueleto do monorepo, repo e infraestrutura (agente pai: instala, cria repo, faz deploy)

**Files:**
- Create: `web/` (create-next-app), `cerebro/pyproject.toml`, `cerebro/.python-version`, `cerebro/agente/__init__.py`, `cerebro/tests/test_sanidade.py`, `web/tests/sanidade.test.ts`, `.gitignore`, `LICENSE`, `README.md`, `.github/workflows/ci.yml`, `cerebro/.env.example`, `web/.env.example`
- Modify: `web/package.json`, `web/tsconfig.json`, `web/.gitignore`

**Interfaces:**
- Produces: `cd cerebro && uv run pytest`; `cd web && npm test`. Projetos Vercel `geniai-web` (raiz `web/`, Neon ligado) e `geniai-cerebro` (raiz `cerebro/`). `.env` em cada pasta via `vercel env pull`.

- [ ] **Step 1: ferramentas**

```bash
brew install uv
uv python install 3.12
```

- [ ] **Step 2: `web/`**

```bash
cd /tmp && npx create-next-app@16.3.6 geniai-web --ts --tailwind --biome --app --no-src-dir --import-alias '@/*' --use-npm --disable-git --skip-install --yes
cp -R /tmp/geniai-web/. ~/geniai-agente/web/
cd ~/geniai-agente/web && npm i && npm i @neondatabase/serverless@^1.1
cp ~/geniai-agente/docs/marca/geniai-icone.png public/geniai-icone.png
```

`web/package.json`: acrescentar `"type": "module"`, `"license": "MIT"`, `"engines": { "node": ">=22.18" }` e os scripts:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "biome check",
  "format": "biome format --write",
  "test": "node --test 'tests/**/*.test.ts'"
}
```

`web/tsconfig.json` → `compilerOptions`: `"allowImportingTsExtensions": true`, `"verbatimModuleSyntax": true`. `web/.gitignore`: acrescentar `!.env.example`.

`web/tests/sanidade.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('node roda teste em TypeScript', () => {
  const soma = (a: number, b: number): number => a + b
  assert.equal(soma(2, 2), 4)
})
```

`web/.env.example`:

```bash
DATABASE_URL=
ZAPI_INSTANCE_ID=
ZAPI_TOKEN=
ZAPI_CLIENT_TOKEN=
# openssl rand -hex 24
WEBHOOK_SECRET=
DASHBOARD_USER=geniai
DASHBOARD_PASSWORD=
CEREBRO_URL=https://geniai-cerebro.vercel.app
# o mesmo valor do cerebro
AGENTE_TOKEN=
DEBOUNCE_MS=6000
```

- [ ] **Step 3: `cerebro/`**

`cerebro/pyproject.toml`:

```toml
[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[project]
name = "geniai-cerebro"
version = "0.1.0"
description = "Cérebro do agente de pré-vendas da GeniAI: LangGraph + gpt-4.1-mini"
requires-python = ">=3.11"
license = "MIT"
dependencies = [
    "fastapi>=0.141",
    "langgraph>=1.2",
    "langchain-openai>=1.6",
    "pydantic>=2.13",
]

[project.optional-dependencies]
dev = ["pytest>=9.1", "ruff>=0.16", "httpx>=0.28"]

[tool.setuptools]
packages = ["agente"]

[tool.ruff]
line-length = 110
target-version = "py311"

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

`cerebro/.python-version`: `3.12`. `cerebro/agente/__init__.py`: vazio.

`cerebro/tests/test_sanidade.py`:

```python
def test_pytest_roda():
    assert 2 + 2 == 4
```

`cerebro/.env.example`:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
AGENTE_TOKEN=
# opcional: rastreio das conversas no LangSmith
LANGSMITH_TRACING=false
LANGSMITH_API_KEY=
```

```bash
cd ~/geniai-agente/cerebro && uv sync --extra dev && uv run pytest && uv run ruff check .
```

- [ ] **Step 4: raiz**

`.gitignore`:

```gitignore
.env*
!.env.example
.venv/
__pycache__/
.pytest_cache/
.ruff_cache/
.vercel
.playwright-cli/
node_modules/
.next/
```

`LICENSE`: MIT, `Copyright (c) 2026 dv-dev1`. `README.md`: duas linhas do que é, mais "em construção; ver `specs/`".

`.github/workflows/ci.yml`:

```yaml
name: ci
on: [push, pull_request]
jobs:
  cerebro:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python: ['3.11', '3.12']
    defaults:
      run:
        working-directory: cerebro
    steps:
      - uses: actions/checkout@v5
      - uses: astral-sh/setup-uv@v6
        with:
          python-version: ${{ matrix.python }}
      - run: uv sync --extra dev
      - run: uv run ruff check .
      - run: uv run pytest
  web:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [22, 24]
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: ${{ matrix.node }}
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test
      - run: npm run build
```

- [ ] **Step 5: verificar as duas pontas**

Run: `cd web && npm test && npm run lint && npx tsc --noEmit && npm run build` e `cd cerebro && uv run pytest`
Expected: tudo verde. Se o `next build` reclamar de `allowImportingTsExtensions`, trocar o runner de teste do `web/` para `vitest` e registrar aqui antes de seguir.

- [ ] **Step 6: repo**

```bash
cd ~/geniai-agente && git init -b main && git add -A && git commit -m "chore: esqueleto do monorepo (web Next.js + cérebro Python) com CI"
gh repo create dv-dev1/geniai-agente --public --source . --push
```

- [ ] **Step 7: Vercel + Neon + env** (o usuário roda os comandos interativos com `!`)

```bash
npm i -g vercel
! vercel login
cd ~/geniai-agente/web && vercel link --yes --project geniai-web
cd ~/geniai-agente/cerebro && vercel link --yes --project geniai-cerebro
# nos dois projetos, no painel: Settings → Build → Root Directory = web / cerebro; e Git → conectar dv-dev1/geniai-agente
cd ~/geniai-agente/web && vercel integration add neon    # ou painel: Storage → Neon → conectar ao geniai-web
TOKEN=$(openssl rand -hex 24)
cd ~/geniai-agente/cerebro && ! vercel env add OPENAI_API_KEY && printf 'gpt-4.1-mini' | vercel env add OPENAI_MODEL production \
  && printf "$TOKEN" | vercel env add AGENTE_TOKEN production
cd ~/geniai-agente/web && printf "$TOKEN" | vercel env add AGENTE_TOKEN production \
  && printf 'https://geniai-cerebro.vercel.app' | vercel env add CEREBRO_URL production \
  && printf "$(openssl rand -hex 24)" | vercel env add WEBHOOK_SECRET production \
  && printf 'geniai' | vercel env add DASHBOARD_USER production && ! vercel env add DASHBOARD_PASSWORD
# repetir para o ambiente development (vercel env add NOME development) e então:
cd ~/geniai-agente/cerebro && vercel env pull .env
cd ~/geniai-agente/web && vercel env pull .env.local
```

As credenciais da Z-API (`ZAPI_*`) entram na Tarefa 9.

---

### Task 2: `cerebro/agente/lead.py` — modelo, merge, score, temperatura, etapa (TDD)

**Files:**
- Create: `cerebro/agente/lead.py`
- Test: `cerebro/tests/test_lead.py`
- Delete: `cerebro/tests/test_sanidade.py`

**Interfaces:**
- Produces:
  - `Servico = Literal['audiobot', 'disparador']`, `Etapa`, `Temperatura` (Literals)
  - `class Lead(BaseModel)`, todos os campos **sem default**, porque o structured output strict exige todos presentes:
    - `nome, empresa, segmento, cidade: str | None`
    - `porte: Literal['MEI','ME','EPP','media','grande'] | None`, `colaboradores: int | None`, `dor: str | None`
    - `servicos: list[Servico]`
    - `plano: Literal['inicial','padrao','premium'] | None` (Audiobot), `base_clientes: int | None` (Disparador, número de contatos)
    - `urgencia: Literal['imediata','ate_3_meses','sem_pressa'] | None`
    - `decisor, pediu_contato, fora_do_perfil: bool | None`, `telefone: str | None`
  - `Lead.vazio() -> Lead`, `Lead.de_dict(dados: dict) -> Lead` (completa o que faltar com vazio)
  - `mesclar(atual: Lead, novo: Lead) -> Lead`, `pontuar(lead: Lead) -> int`, `temperatura(score: int) -> Temperatura`, `etapa(lead: Lead) -> Etapa`

- [ ] **Step 1: teste que falha** — `cerebro/tests/test_lead.py`

```python
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
```

- [ ] **Step 2: rodar e ver falhar**

Run: `cd cerebro && uv run pytest`
Expected: FAIL — `ModuleNotFoundError: No module named 'agente.lead'`

- [ ] **Step 3: implementação** — `cerebro/agente/lead.py`

```python
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
    segmento: str | None
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
    if lead.nome or lead.empresa or lead.segmento or lead.porte or lead.colaboradores is not None:
        return "triagem"
    return "novo"
```

- [ ] **Step 4: rodar e ver passar**; apagar `tests/test_sanidade.py`

Run: `cd cerebro && uv run pytest && uv run ruff check .`
Expected: 13 passed; ruff limpo.

- [ ] **Step 5: prova de vermelho** — trocar `>= 70` por `> 70` em `temperatura`, rodar (deve falhar "restaurante… é quente"), desfazer.

- [ ] **Step 6: devolver ao pai para commit** — `feat(cerebro): lead com score, temperatura e etapa do funil`

---

### Task 3: base de conhecimento, prompt e grafo LangGraph (TDD com LLM falso)

**Files:**
- Create: `cerebro/kb/empresa.md`, `cerebro/kb/audiobot.md`, `cerebro/kb/disparador.md`, `cerebro/kb/faq.md`, `cerebro/agente/prompts.py`, `cerebro/agente/grafo.py`, `cerebro/agente/chat.py`
- Test: `cerebro/tests/test_grafo.py`

**Interfaces:**
- Consumes: `Lead`, `mesclar`, `pontuar`, `temperatura`, `etapa`, `Etapa`, `Temperatura` (Tarefa 2)
- Produces:
  - `prompts.MAX_MENSAGENS_BOT = 7`, `prompts.SISTEMA: str`
  - `grafo.Turno` (TypedDict `{autor: Literal['cliente','bot','humano'], texto: str}`)
  - `grafo.Resposta(BaseModel)`: `mensagem: str`, `lead: Lead`, `acao: Literal['continuar','encaminhar_humano','encerrar']`
  - `grafo.chamar_llm(mensagens: list[BaseMessage]) -> tuple[Resposta, dict[str, int]]`, o ponto de troca nos testes
  - `grafo.responder(historico: list[Turno], lead: Lead, msgs_bot: int, telefone_conhecido: bool) -> dict` com as chaves `resposta: Resposta`, `lead: Lead` (já mesclado), `score: int`, `temperatura`, `etapa`, `uso: {entrada, cache, saida}`

- [ ] **Step 1: `cerebro/kb/empresa.md`** (fonte de toda a base: `docs/respostas-geniai.md`)

```markdown
# GeniAI

GeniAI Soluções em Inteligência Artificial Ltda, empresa de João Pessoa/PB. Atende o Brasil todo, de forma remota: não vai presencialmente até o cliente.

Produtos: Audiobot (o carro-chefe) e Disparador.

Horário do time: o especialista responde das 8h às 17h.

Site: geniai.online · Instagram @geniaioficial
Política de privacidade: https://www.geniai.online/legal/privacy-policy
```

- [ ] **Step 2: `cerebro/kb/audiobot.md`**

```markdown
# Audiobot

O carro-chefe da GeniAI. Aparelho (hardware) instalado no ambiente, que grava o áudio e gera transcrições e relatórios inteligentes. Vira uma fonte de dados sobre o que acontece na empresa.

Para que serve:
- gravar reuniões e ter a transcrição e o relatório depois;
- acompanhar a rotina de um ambiente, como a cozinha de um restaurante ou a recepção de uma clínica;
- dar visibilidade aos processos e ao fluxo de trabalho;
- segurança no ambiente de trabalho e qualidade do atendimento, por exemplo perceber um atendimento mal conduzido.

Para quem: empresas de qualquer segmento e porte; não há um perfil único.

Planos:
- Inicial: R$ 299, até 4 horas de transcrição por dia.
- Padrão: R$ 399, até 8 horas de transcrição por dia.
- Premium: R$ 799, 24 horas de transcrição por dia.
A periodicidade da cobrança o especialista confirma.

Entrega: cerca de uma semana, conforme o estoque. Em João Pessoa, a retirada é combinada com um vendedor. Fora de João Pessoa, o envio é pelos Correios.
```

- [ ] **Step 3: `cerebro/kb/disparador.md`**

```markdown
# Disparador

Disparo de mensagens em massa no WhatsApp pela API oficial do WhatsApp. Resolve o limite do WhatsApp comum, que não deixa enviar ou encaminhar para muitos contatos de uma vez.

Para quem: empresas que têm uma base de clientes e querem falar com todos de uma vez.

Valores: R$ 999 de implementação, uma vez, mais R$ 499 de mensalidade.
Prazo de implementação: até um mês.
```

- [ ] **Step 4: `cerebro/kb/faq.md`**

```markdown
# Perguntas frequentes

- Quanto custa? Audiobot: planos de R$ 299, R$ 399 e R$ 799. Disparador: R$ 999 de implementação mais R$ 499 de mensalidade.
- Atende minha cidade? A GeniAI atende o Brasil todo, remotamente. Fora de João Pessoa, o Audiobot vai pelos Correios.
- Atende MEI ou empresa pequena? Sim, empresas de qualquer porte.
- Quando o especialista responde? Das 8h às 17h.
- Vocês têm cases ou clientes para mostrar? Isso o especialista mostra na conversa.
```

- [ ] **Step 5: `cerebro/agente/prompts.py`**

```python
from pathlib import Path

MAX_MENSAGENS_BOT = 7

_KB = "\n\n".join(p.read_text(encoding="utf-8") for p in sorted((Path(__file__).parent.parent / "kb").glob("*.md")))

# Fixo e no começo da conversa para a OpenAI cachear o prefixo (input em cache custa 1/4).
SISTEMA = f"""Você é a Gê, assistente virtual da GeniAI, atendendo no WhatsApp.
Seu trabalho: receber quem chega, entender a empresa e o que ela precisa, mostrar o produto da GeniAI que resolve e levar a pessoa a falar com um especialista.

# Cada mensagem custa dinheiro
Toda mensagem que você envia é cobrada. Por isso:
- Responda com UMA mensagem por turno, de até 600 caracteres.
- Junte na mesma mensagem o que puder: saudação e pergunta, reconhecimento e próxima pergunta.
- Chegue ao encaminhamento em no máximo {MAX_MENSAGENS_BOT} mensagens suas. Na {MAX_MENSAGENS_BOT - 1}ª, se ainda não encaminhou, ofereça o especialista.
- Pergunte só o que falta. Nunca pergunte de novo o que já está nos dados do lead.

# Roteiro
1. Primeira mensagem: cumprimente, diga que é a Gê, assistente virtual da GeniAI, avise em uma linha que os dados da conversa são usados só para o atendimento (https://www.geniai.online/legal/privacy-policy) e pergunte o nome e a empresa ou segmento.
2. Numa pergunta só: o que a pessoa procura, com opções numeradas (1) Audiobot: grava o ambiente e gera transcrições e relatórios; 2) Disparador: mensagens em massa no WhatsApp; 3) Ainda não sei), o porte (MEI, ME, EPP, média ou grande) e quantas pessoas trabalham lá.
3. Entenda a necessidade. No Audiobot: qual ambiente quer acompanhar (reunião, cozinha, atendimento...) e por quantas horas por dia. No Disparador: para que quer disparar e quantos contatos tem na base. Se a pessoa não sabe qual produto, pergunte qual problema quer resolver e indique o que resolve.
4. Apresente o produto em linguagem simples, com o preço da base. No Audiobot, indique o plano pelas horas por dia. Na mesma mensagem pergunte se quer falar com um especialista.
5. Se quiser: pergunte na mesma mensagem a cidade (para a entrega do Audiobot), para quando pensa em começar e se é quem decide. Com a resposta, avise que vai passar para um especialista, que responde das 8h às 17h, e use acao "encaminhar_humano".
Se a pessoa já disse algo que pula etapas, pule junto.
Se a pessoa não quiser falar com especialista agora, agradeça, deixe a porta aberta e use acao "encerrar".

# Regras
- Português do Brasil, tom cordial e direto, sem jargão. Formatação do WhatsApp: *negrito* com um asterisco.
- Nunca use emoji.
- Use só o que está na base de conhecimento abaixo. Não invente preço, prazo, plano, funcionalidade, cliente, case ou número. O que não estiver na base: diga que o especialista confirma.
- Nunca cite cases, clientes ou resultados.
- Nunca prometa resultado.
- Se a mensagem do cliente for "[áudio]", diga que por enquanto você só lê texto e peça para escrever.
- Pediu humano, atendente, reunião, ligação ou proposta, em qualquer momento: avise que vai passar para um especialista, pediu_contato = true e acao = "encaminhar_humano".
- Fora do perfil (vaga de emprego, fornecedor oferecendo algo, spam, assunto sem relação com a GeniAI): responda com educação em uma mensagem, fora_do_perfil = true e acao = "encerrar".
- Se telefone_conhecido for "não", peça um telefone para contato na mensagem de encaminhamento e preencha "telefone".
- Mensagens marcadas com [atendente humano] foram escritas por alguém do time; não as contradiga.

# Dados do lead
Em "lead", preencha só o que o cliente disse nesta conversa. O que não souber fica null; nunca adivinhe.
- porte: MEI, ME, EPP, media ou grande. Se só disser o número de pessoas, deixe porte null.
- servicos: "audiobot" e/ou "disparador", só os que o cliente mostrou interesse.
- plano: "inicial", "padrao" ou "premium", só se o cliente escolher um plano do Audiobot.
- base_clientes: número de contatos da base, só se o cliente disser.
- cidade e urgencia: só se o cliente disser.
- decisor: true se disser que é dono, sócio, diretor ou quem decide; false se disser que depende de outra pessoa.

# Base de conhecimento
{_KB}"""
```

- [ ] **Step 6: teste que falha** — `cerebro/tests/test_grafo.py`

```python
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
```

- [ ] **Step 7: rodar e ver falhar**

Run: `cd cerebro && uv run pytest tests/test_grafo.py`
Expected: FAIL — `ImportError: cannot import name 'grafo'`

- [ ] **Step 8: implementação** — `cerebro/agente/grafo.py`

```python
import os
from functools import cache
from typing import Literal, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel

from .lead import Etapa, Lead, Temperatura, etapa, mesclar, pontuar, temperatura
from .prompts import MAX_MENSAGENS_BOT, SISTEMA


class Turno(TypedDict):
    autor: Literal["cliente", "bot", "humano"]
    texto: str


class Resposta(BaseModel):
    mensagem: str
    lead: Lead
    acao: Literal["continuar", "encaminhar_humano", "encerrar"]


class Estado(TypedDict, total=False):
    historico: list[Turno]
    lead: Lead
    msgs_bot: int
    telefone_conhecido: bool
    resposta: Resposta
    uso: dict[str, int]
    score: int
    temperatura: Temperatura
    etapa: Etapa


@cache
def _modelo():
    llm = ChatOpenAI(model=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"), temperature=0.4, max_retries=2, timeout=30)
    return llm.with_structured_output(Resposta, method="json_schema", strict=True, include_raw=True)


def chamar_llm(mensagens: list[BaseMessage]) -> tuple[Resposta, dict[str, int]]:
    saida = _modelo().invoke(mensagens)
    if saida["parsed"] is None:
        raise RuntimeError(f"sem resposta estruturada: {saida['parsing_error']}")
    u = saida["raw"].usage_metadata or {}
    uso = {
        "entrada": u.get("input_tokens", 0),
        "cache": u.get("input_token_details", {}).get("cache_read", 0),
        "saida": u.get("output_tokens", 0),
    }
    return saida["parsed"], uso


def _mensagem(t: Turno) -> BaseMessage:
    if t["autor"] == "cliente":
        return HumanMessage(t["texto"])
    return AIMessage(f"[atendente humano] {t['texto']}" if t["autor"] == "humano" else t["texto"])


def _situacao(e: Estado) -> str:
    return (
        "Estado atual (não mostre ao cliente):\n"
        f"- mensagens que você já enviou: {e['msgs_bot']} de no máximo {MAX_MENSAGENS_BOT}\n"
        f"- telefone_conhecido: {'sim' if e['telefone_conhecido'] else 'não'}\n"
        f"- dados do lead até agora: {e['lead'].model_dump_json()}"
    )


def agente(e: Estado) -> Estado:
    resposta, uso = chamar_llm([SystemMessage(SISTEMA), *map(_mensagem, e["historico"]), SystemMessage(_situacao(e))])
    return {"resposta": resposta, "uso": uso}


def qualificar(e: Estado) -> Estado:
    lead = mesclar(e["lead"], e["resposta"].lead)
    score = pontuar(lead)
    return {"lead": lead, "score": score, "temperatura": temperatura(score), "etapa": etapa(lead)}


# Sem checkpointer: o estado da conversa mora no Postgres do web/, que o dashboard lê.
_grafo = (
    StateGraph(Estado)
    .add_node("agente", agente)
    .add_node("qualificar", qualificar)
    .add_edge(START, "agente")
    .add_edge("agente", "qualificar")
    .add_edge("qualificar", END)
    .compile()
)


def responder(historico: list[Turno], lead: Lead, msgs_bot: int, telefone_conhecido: bool) -> Estado:
    return _grafo.invoke(
        {"historico": historico, "lead": lead, "msgs_bot": msgs_bot, "telefone_conhecido": telefone_conhecido}
    )
```

- [ ] **Step 9: rodar e ver passar**

Run: `cd cerebro && uv run pytest && uv run ruff check .`
Expected: todos passam.

- [ ] **Step 10: prova de vermelho** — em `qualificar`, trocar `mesclar(e["lead"], e["resposta"].lead)` por `e["resposta"].lead`, rodar (deve falhar "grafo mescla…"), desfazer.

- [ ] **Step 11: `cerebro/agente/chat.py`**

```python
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
```

- [ ] **Step 12: conversa manual**

Run: `cd cerebro && uv run --env-file .env python -m agente.chat` e conversar como dono de uma loja de 12 funcionários com atendimento lento.
Expected: a primeira resposta traz saudação, aviso de privacidade com link e pergunta de nome e empresa numa mensagem só. O lead vai sendo preenchido e a conversa termina em `encaminhar_humano`. Se a OpenAI recusar o schema strict, é aqui que aparece: corrigir o `Lead` (nunca afrouxar o `strict`).

- [ ] **Step 13: devolver ao pai para commit** — `feat(cerebro): grafo LangGraph com base de conhecimento e chat no terminal`

---

### Task 4: `cerebro/main.py` — rota `/responder` com token (TDD)

**Files:**
- Create: `cerebro/main.py`
- Test: `cerebro/tests/test_api.py`

**Interfaces:**
- Consumes: `grafo.responder`, `grafo.Turno`, `grafo.Resposta`, `Lead` (Tarefas 2 e 3)
- Produces: `POST /responder` com header `Authorization: Bearer <AGENTE_TOKEN>` e corpo `{historico: Turno[], lead?: object, msgs_bot?: int, telefone_conhecido?: bool}`. Devolve `200 {mensagem, acao, lead, score, temperatura, etapa, uso}` ou `401`. É o contrato que o `web/` consome na Tarefa 7.

- [ ] **Step 1: teste que falha** — `cerebro/tests/test_api.py`

```python
from fastapi.testclient import TestClient

import main
from agente.grafo import Resposta
from agente.lead import Lead

cliente = TestClient(main.app)
PEDIDO = {"historico": [{"autor": "cliente", "texto": "oi"}], "lead": {"nome": "Ana"}, "msgs_bot": 0}


def grafo_falso(historico, lead, msgs_bot, telefone_conhecido):
    return {
        "resposta": Resposta(mensagem="olá!", lead=Lead.vazio(), acao="continuar"),
        "lead": lead, "score": 5, "temperatura": "frio", "etapa": "triagem",
        "uso": {"entrada": 1, "cache": 0, "saida": 1},
    }


def test_sem_token_recusa(monkeypatch):
    monkeypatch.setenv("AGENTE_TOKEN", "segredo")
    assert cliente.post("/responder", json=PEDIDO).status_code == 401
    assert cliente.post("/responder", json=PEDIDO, headers={"Authorization": "Bearer errado"}).status_code == 401


def test_sem_token_configurado_fecha(monkeypatch):
    monkeypatch.delenv("AGENTE_TOKEN", raising=False)
    assert cliente.post("/responder", json=PEDIDO, headers={"Authorization": "Bearer "}).status_code == 401


def test_com_token_devolve_o_veredito(monkeypatch):
    monkeypatch.setenv("AGENTE_TOKEN", "segredo")
    monkeypatch.setattr(main, "responder", grafo_falso)
    r = cliente.post("/responder", json=PEDIDO, headers={"Authorization": "Bearer segredo"})
    assert r.status_code == 200
    assert r.json() | {"lead": None} == {
        "mensagem": "olá!", "acao": "continuar", "lead": None, "score": 5,
        "temperatura": "frio", "etapa": "triagem", "uso": {"entrada": 1, "cache": 0, "saida": 1},
    }
    assert r.json()["lead"]["nome"] == "Ana"
```

- [ ] **Step 2: rodar e ver falhar**

Run: `cd cerebro && uv run pytest tests/test_api.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 3: implementação** — `cerebro/main.py`

```python
import os
import secrets

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

from agente.grafo import Turno, responder
from agente.lead import Lead

app = FastAPI(title="GeniAI · cérebro")


class Pedido(BaseModel):
    historico: list[Turno]
    lead: dict = {}
    msgs_bot: int = 0
    telefone_conhecido: bool = True


def exigir_token(authorization: str = Header(default="")) -> None:
    token = os.environ.get("AGENTE_TOKEN", "")
    # Rota pública na Vercel: sem o token, qualquer um gastaria o crédito da OpenAI.
    # Em bytes porque compare_digest recusa str não-ASCII, e o header pode chegar em latin-1.
    if not token or not secrets.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
        raise HTTPException(status_code=401)


# Como dependência, o token é checado antes da validação do corpo: sem token, 401 e não 422.
@app.post("/responder", dependencies=[Depends(exigir_token)])
def rota_responder(pedido: Pedido) -> dict:
    r = responder(pedido.historico, Lead.de_dict(pedido.lead), pedido.msgs_bot, pedido.telefone_conhecido)
    return {
        "mensagem": r["resposta"].mensagem,
        "acao": r["resposta"].acao,
        "lead": r["lead"].model_dump(),
        "score": r["score"],
        "temperatura": r["temperatura"],
        "etapa": r["etapa"],
        "uso": r["uso"],
    }
```

- [ ] **Step 4: rodar e ver passar**

Run: `cd cerebro && uv run pytest && uv run ruff check .`
Expected: todos passam.

- [ ] **Step 5: prova de vermelho** — trocar `if not token or not …` por `if not secrets.compare_digest(…)`, rodar (deve falhar "sem token configurado fecha"), desfazer.

- [ ] **Step 6: devolver ao pai para commit** — `feat(cerebro): rota /responder protegida por token`. Depois do commit, o pai roda `cd cerebro && vercel --prod` e confere que `curl -s -o /dev/null -w '%{http_code}' -X POST https://geniai-cerebro.vercel.app/responder -d '{}'` devolve `401`.

---

### Task 5: `cerebro/agente/avaliar.py` — personas simuladas (regressão do prompt)

**Files:**
- Create: `cerebro/agente/avaliar.py`
- Modify: `cerebro/agente/prompts.py` (só se as personas falharem)

**Interfaces:**
- Consumes: `grafo.responder`, `grafo.Turno`, `Lead`, `MAX_MENSAGENS_BOT`
- Produces: `uv run --env-file .env python -m agente.avaliar [--mostrar]`, com exit 0 quando todas as personas passam. É o critério de aceite da spec.

- [ ] **Step 1: `cerebro/agente/avaliar.py`**

```python
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from langchain_openai import ChatOpenAI

from .grafo import Turno, responder
from .lead import Lead
from .prompts import MAX_MENSAGENS_BOT

PRECO_USD_POR_MILHAO = {"entrada": 0.40, "cache": 0.10, "saida": 1.60}


@dataclass
class Persona:
    nome: str
    esperado: str
    perfil: str


PERSONAS = [
    Persona("MEI curiosa", "frio", "Você é a Carla, manicure, MEI, trabalha sozinha. Viu um post da GeniAI e ficou curiosa, mas não tem um problema específico, não tem pressa e não quer falar com especialista agora (\"vou pensar\")."),
    Persona("Restaurante", "quente", "Você é o Marcos, dono de um restaurante em Recife (ME, 12 funcionários). Não sabe o que acontece na cozinha quando não está lá e quer acompanhar umas 8 horas por dia. Quer começar no mês que vem e quer falar com um especialista."),
    Persona("Gerente de varejo", "morno", "Você é a Paula, gerente de marketing de uma rede de lojas média (80 funcionários). Hoje avisa os clientes das promoções um a um no WhatsApp. Não sabe quantos contatos tem na base, não decide sozinha, depende da diretoria, não tem pressa e agora não quer marcar conversa: prefere pensar."),
    Persona("Candidato a vaga", "frio", "Você é o Lucas, desenvolvedor, e quer saber se a GeniAI está contratando. Você não é cliente."),
    Persona("Só quer preço", "quente", "Você é a Renata, sócia de uma clínica odontológica (EPP, 20 funcionários). Quer gravar o atendimento da recepção e insiste em saber quanto custa antes de qualquer coisa. Depois de saber o preço, aceita falar com um especialista."),
    Persona("Distribuidora decidida", "quente", "Você é o Roberto, diretor de uma distribuidora de bebidas (grande, 300 funcionários). Tem uma base de uns 50 mil clientes e quer mandar avisos e promoções para todos pelo WhatsApp. Quer começar já e pede logo uma reunião."),
]


def fala_do_cliente(p: Persona, historico: list[Turno]) -> str:
    llm = ChatOpenAI(model=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"), temperature=0.7, max_tokens=200)
    mensagens = [("system", f"Você faz o papel de um cliente no WhatsApp para testar um atendimento. {p.perfil}\n"
                            "Escreva só a próxima mensagem do cliente: curta e informal. Responda ao que foi "
                            "perguntado sem entregar tudo de uma vez.")]
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
    ok = msgs_bot <= MAX_MENSAGENS_BOT and temp == p.esperado and acao != "continuar"
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
```

- [ ] **Step 2: rodar**

Run: `cd cerebro && uv run --env-file .env python -m agente.avaliar`
Expected: tabela com 6 linhas. Se alguma disser `FALHOU`, ler a transcrição impressa e ajustar **só `agente/prompts.py`**, sem mexer no score para fazer o teste passar. Parar quando rodar **2 vezes seguidas** com todas `ok`, porque o LLM varia. Se depois de 4 ajustes uma persona continuar falhando, devolver ao pai com a transcrição.

- [ ] **Step 3: `uv run ruff check . && uv run pytest`** — verde.

- [ ] **Step 4: devolver ao pai para commit** — `test(cerebro): personas simuladas medem mensagens e temperatura`, com a tabela da última rodada no relatório.

---

### Task 6: `web/lib/zapi.ts` — parse do webhook e envio de texto (TDD)

**Files:**
- Create: `web/lib/zapi.ts`, `web/lib/tipos.ts`
- Test: `web/tests/zapi.test.ts`
- Delete: `web/tests/sanidade.test.ts`

**Interfaces:**
- Produces:
  - `web/lib/tipos.ts`: `ETAPAS`, `STATUS_COMERCIAL` (readonly tuples), `type Etapa`, `type Temperatura = 'quente'|'morno'|'frio'`, `type Turno = { autor: 'cliente'|'bot'|'humano'; texto: string }`, `type Lead = Record<string, unknown>`
  - `type Evento = { tipo: 'cliente'; id; contato; phone; nome: string | null; texto } | { tipo: 'humano'; id; contato; phone; texto } | { tipo: 'ignorar' }` (todos `string`, exceto onde dito)
  - `lerEvento(body: unknown): Evento`, `enviarTexto(phone: string, message: string): Promise<string>`

Payload: `https://developer.z-api.io/webhooks/on-message-received` (exemplos em `github.com/z-api/docs`, `webhooks/on-message-received-examples.mdx`).

- [ ] **Step 1: `web/lib/tipos.ts`**

```ts
export const ETAPAS = ['novo', 'triagem', 'apresentacao', 'interesse', 'encaminhado', 'perdido'] as const
export const STATUS_COMERCIAL = ['a_contatar', 'contatado', 'reuniao', 'fechado', 'perdido'] as const

export type Etapa = (typeof ETAPAS)[number]
export type Temperatura = 'quente' | 'morno' | 'frio'
export type Turno = { autor: 'cliente' | 'bot' | 'humano'; texto: string }
// O cérebro (Python) é dono do formato do lead; aqui ele só é guardado e exibido.
export type Lead = Record<string, unknown>
```

- [ ] **Step 2: teste que falha** — `web/tests/zapi.test.ts`

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enviarTexto, lerEvento } from '../lib/zapi.ts'

const base = {
  type: 'ReceivedCallback', messageId: 'M1', phone: '5583999990000', chatLid: '111@lid',
  senderName: 'Ana', fromMe: false, fromApi: false, isGroup: false, isNewsletter: false,
  broadcast: false, isStatusReply: false, isEdit: false, waitingMessage: false,
  text: { message: 'oi' },
}
const { text: _texto, ...semTexto } = base

test('texto do cliente usa chatLid como contato e guarda o telefone', () => {
  assert.deepEqual(lerEvento(base), { tipo: 'cliente', id: 'M1', contato: '111@lid', phone: '5583999990000', nome: 'Ana', texto: 'oi' })
})

test('sem chatLid o contato é o phone', () => {
  const e = lerEvento({ ...base, chatLid: null })
  assert.equal(e.tipo === 'cliente' && e.contato, '5583999990000')
})

test('grupo, newsletter, lista, resposta de status, edição e mensagem aguardando são ignorados', () => {
  for (const flag of ['isGroup', 'isNewsletter', 'broadcast', 'isStatusReply', 'isEdit', 'waitingMessage']) {
    assert.equal(lerEvento({ ...base, [flag]: true }).tipo, 'ignorar', flag)
  }
})

test('eco do que o próprio bot enviou é ignorado', () => {
  assert.equal(lerEvento({ ...base, fromMe: true, fromApi: true }).tipo, 'ignorar')
})

test('mensagem digitada no celular da empresa é humano, com texto ou mídia', () => {
  assert.equal(lerEvento({ ...base, fromMe: true, text: { message: 'Oi, aqui é o Pedro' } }).tipo, 'humano')
  assert.equal(lerEvento({ ...semTexto, fromMe: true, image: { imageUrl: 'x' } }).tipo, 'humano')
})

test('áudio do cliente vira [áudio] e legenda de imagem vira texto', () => {
  const audio = lerEvento({ ...semTexto, audio: { ptt: true, audioUrl: 'x' } })
  const imagem = lerEvento({ ...semTexto, image: { caption: 'meu cardápio' } })
  assert.equal(audio.tipo === 'cliente' && audio.texto, '[áudio]')
  assert.equal(imagem.tipo === 'cliente' && imagem.texto, 'meu cardápio')
})

test('figurinha, outro tipo de callback e corpo inválido são ignorados', () => {
  assert.equal(lerEvento({ ...semTexto, sticker: { stickerUrl: 'x' } }).tipo, 'ignorar')
  assert.equal(lerEvento({ ...base, type: 'MessageStatusCallback' }).tipo, 'ignorar')
  assert.equal(lerEvento(null).tipo, 'ignorar')
  assert.equal(lerEvento('lixo').tipo, 'ignorar')
})

test('enviarTexto chama send-text com Client-Token e devolve o messageId', async (t) => {
  process.env.ZAPI_INSTANCE_ID = 'INST'
  process.env.ZAPI_TOKEN = 'TOK'
  process.env.ZAPI_CLIENT_TOKEN = 'SEG'
  const chamadas: [string, RequestInit][] = []
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    chamadas.push([url, init])
    return Response.json({ zaapId: 'Z', messageId: 'ENV1', id: 'ENV1' })
  })
  assert.equal(await enviarTexto('5583999990000', 'olá'), 'ENV1')
  const [url, init] = chamadas[0]
  assert.equal(url, 'https://api.z-api.io/instances/INST/token/TOK/send-text')
  assert.equal((init.headers as Record<string, string>)['Client-Token'], 'SEG')
  assert.deepEqual(JSON.parse(String(init.body)), { phone: '5583999990000', message: 'olá' })
})

test('enviarTexto falha alto quando a Z-API recusa', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{"error":"null not allowed"}', { status: 400 }))
  await assert.rejects(enviarTexto('1', 'x'), /Z-API send-text 400/)
})
```

- [ ] **Step 3: rodar e ver falhar**

Run: `cd web && npm test`
Expected: FAIL — `Cannot find module '.../lib/zapi.ts'`

- [ ] **Step 4: implementação** — `web/lib/zapi.ts`

```ts
export type Evento =
  | { tipo: 'cliente'; id: string; contato: string; phone: string; nome: string | null; texto: string }
  | { tipo: 'humano'; id: string; contato: string; phone: string; texto: string }
  | { tipo: 'ignorar' }

type Payload = {
  type?: string
  messageId?: string
  phone?: string
  chatLid?: string | null
  senderName?: string
  fromMe?: boolean
  fromApi?: boolean
  isGroup?: boolean
  isNewsletter?: boolean
  broadcast?: boolean
  isStatusReply?: boolean
  isEdit?: boolean
  waitingMessage?: boolean
  text?: { message?: string }
  image?: { caption?: string }
  audio?: unknown
}

const IGNORAR: Evento = { tipo: 'ignorar' }

export function lerEvento(body: unknown): Evento {
  if (typeof body !== 'object' || body === null) return IGNORAR
  const p = body as Payload
  if (p.type !== 'ReceivedCallback' || !p.messageId) return IGNORAR
  if (p.isGroup || p.isNewsletter || p.broadcast || p.isStatusReply || p.isEdit || p.waitingMessage) return IGNORAR

  // chatLid é o id estável; phone às vezes chega como o próprio @lid, que não converte em número.
  const contato = p.chatLid || p.phone
  if (!contato) return IGNORAR
  const phone = p.phone ?? contato
  const texto = p.text?.message || p.image?.caption || (p.audio ? '[áudio]' : null)

  if (p.fromMe) {
    // fromApi marca o eco do send-text do próprio bot; sem ele, alguém respondeu pelo celular.
    if (p.fromApi) return IGNORAR
    return { tipo: 'humano', id: p.messageId, contato, phone, texto: texto ?? '[mídia]' }
  }
  if (!texto) return IGNORAR
  return { tipo: 'cliente', id: p.messageId, contato, phone, nome: p.senderName ?? null, texto }
}

export async function enviarTexto(phone: string, message: string): Promise<string> {
  const { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN } = process.env
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN ?? '' },
    body: JSON.stringify({ phone, message }),
  })
  if (!r.ok) throw new Error(`Z-API send-text ${r.status}: ${await r.text()}`)
  const { messageId } = (await r.json()) as { messageId: string }
  return messageId
}
```

- [ ] **Step 5: rodar e ver passar**; apagar `tests/sanidade.test.ts`

Run: `cd web && npm test && npm run lint && npx tsc --noEmit`
Expected: PASS em tudo. Se o `tsc` reclamar da assinatura do mock de `fetch`, tipar o mock como `typeof fetch` com `as unknown as typeof fetch`, sem mudar o teste.

- [ ] **Step 6: prova de vermelho** — remover `if (p.fromApi) return IGNORAR`, rodar (deve falhar "eco do que o próprio bot enviou"), desfazer.

- [ ] **Step 7: devolver ao pai para commit** — `feat(web): parse do webhook da Z-API e envio por send-text`

---

### Task 7: banco, cliente do cérebro, fluxo do webhook e rota (TDD no fluxo)

**Files:**
- Create: `web/db/schema.sql`, `web/scripts/migrar.ts`, `web/lib/db.ts`, `web/lib/cerebro.ts`, `web/lib/fluxo.ts`, `web/app/api/webhook/[secret]/route.ts`
- Test: `web/tests/fluxo.test.ts`, `web/tests/cerebro.test.ts`

**Interfaces:**
- Consumes: `Evento`, `lerEvento`, `enviarTexto` (Tarefa 6); `type Turno`, `type Lead`, `type Etapa`, `type Temperatura` de `lib/tipos.ts`; contrato `POST /responder` (Tarefa 4)
- Produces:
  - `lib/cerebro.ts`: `type Pedido = { historico: Turno[]; lead: Lead; msgs_bot: number; telefone_conhecido: boolean }`, `type Veredito = { mensagem: string; acao: 'continuar'|'encaminhar_humano'|'encerrar'; lead: Lead; score: number; temperatura: Temperatura; etapa: Etapa }`, `consultarCerebro(p: Pedido): Promise<Veredito>`
  - `lib/db.ts`: `sql()`, `registrarMensagem(m: NovaMensagem): Promise<boolean>`, `ultimaDoCliente(contato): Promise<string | null>`, `reivindicarPendentes(contato): Promise<number>`, `historico(contato, limite?): Promise<Turno[]>`, `carregarContato(id): Promise<Contato>`, `salvarLead(id, lead, score, temp, etapa): Promise<void>`, `pausar(id, horas): Promise<void>`
  - `type NovaMensagem = { id: string; contato: string; phone: string; nome?: string | null; autor: Turno['autor']; texto: string }`, `type Contato = { id: string; phone: string; lead: Lead; pausado: boolean; msgsBot: number }`
  - `lib/fluxo.ts`: `receber(e: Evento, d: Deps): Promise<void>`, `type Deps`, `FALHA`, `HORAS_PAUSA = 24`
  - tabelas `contatos` e `mensagens` (lidas pelo dashboard na Tarefa 8)

- [ ] **Step 1: `web/db/schema.sql`**

```sql
create table if not exists contatos (
  id text primary key,
  phone text not null,
  nome_whatsapp text,
  lead jsonb not null default '{}',
  score int not null default 0,
  temperatura text not null default 'frio',
  etapa text not null default 'novo',
  status_comercial text not null default 'a_contatar'
    check (status_comercial in ('a_contatar', 'contatado', 'reuniao', 'fechado', 'perdido')),
  pausado_ate timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists mensagens (
  id text primary key,
  contato_id text not null references contatos (id),
  autor text not null check (autor in ('cliente', 'bot', 'humano')),
  texto text not null,
  respondida boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists mensagens_contato on mensagens (contato_id, criado_em);
```

- [ ] **Step 2: `web/scripts/migrar.ts`**

```ts
import { readFileSync } from 'node:fs'
import { Pool } from '@neondatabase/serverless'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
await pool.query(readFileSync('db/schema.sql', 'utf8'))
await pool.end()
console.log('schema aplicado')
```

- [ ] **Step 3: `web/lib/db.ts`**

```ts
import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import type { Etapa, Lead, Temperatura, Turno } from './tipos.ts'

export type NovaMensagem = { id: string; contato: string; phone: string; nome?: string | null; autor: Turno['autor']; texto: string }
export type Contato = { id: string; phone: string; lead: Lead; pausado: boolean; msgsBot: number }

let conexao: NeonQueryFunction<false, false> | undefined
// Preguiçoso: o next build importa este módulo sem DATABASE_URL.
export const sql = () => (conexao ??= neon(process.env.DATABASE_URL ?? ''))

export async function registrarMensagem(m: NovaMensagem): Promise<boolean> {
  // Um @lid que chega depois não apaga o telefone real que a equipe precisa para ligar.
  await sql()`insert into contatos (id, phone, nome_whatsapp) values (${m.contato}, ${m.phone}, ${m.nome ?? null})
    on conflict (id) do update set
      phone = case when excluded.phone like '%@lid' then contatos.phone else excluded.phone end,
      nome_whatsapp = coalesce(excluded.nome_whatsapp, contatos.nome_whatsapp)`
  const r = await sql()`insert into mensagens (id, contato_id, autor, texto, respondida)
    values (${m.id}, ${m.contato}, ${m.autor}, ${m.texto}, ${m.autor !== 'cliente'})
    on conflict (id) do nothing returning id`
  return r.length > 0
}

export async function ultimaDoCliente(contato: string): Promise<string | null> {
  const r = await sql()`select id from mensagens where contato_id = ${contato} and autor = 'cliente'
    order by criado_em desc limit 1`
  return (r[0]?.id as string | undefined) ?? null
}

export async function reivindicarPendentes(contato: string): Promise<number> {
  const r = await sql()`update mensagens set respondida = true
    where contato_id = ${contato} and autor = 'cliente' and not respondida returning id`
  return r.length
}

export async function historico(contato: string, limite = 40): Promise<Turno[]> {
  const r = await sql()`select autor, texto from (
      select autor, texto, criado_em from mensagens where contato_id = ${contato} order by criado_em desc limit ${limite}
    ) t order by criado_em`
  return r as Turno[]
}

export async function carregarContato(id: string): Promise<Contato> {
  const [c] = await sql()`select c.id, c.phone, c.lead, c.pausado_ate > now() as pausado,
      (select count(*)::int from mensagens m where m.contato_id = c.id and m.autor = 'bot') as msgs_bot
    from contatos c where c.id = ${id}`
  return { id: c.id, phone: c.phone, lead: c.lead, pausado: c.pausado === true, msgsBot: c.msgs_bot }
}

export async function salvarLead(id: string, lead: Lead, score: number, temp: Temperatura, et: Etapa): Promise<void> {
  await sql()`update contatos set lead = ${JSON.stringify(lead)}::jsonb, score = ${score}, temperatura = ${temp},
    etapa = ${et}, atualizado_em = now() where id = ${id}`
}

export async function pausar(id: string, horas: number): Promise<void> {
  await sql()`update contatos set pausado_ate = now() + make_interval(hours => ${horas}) where id = ${id}`
}
```

- [ ] **Step 4: teste que falha do cliente** — `web/tests/cerebro.test.ts`

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { consultarCerebro } from '../lib/cerebro.ts'

const pedido = { historico: [{ autor: 'cliente' as const, texto: 'oi' }], lead: {}, msgs_bot: 0, telefone_conhecido: true }

test('consultarCerebro manda Bearer e o pedido para /responder', async (t) => {
  process.env.CEREBRO_URL = 'https://cerebro.test'
  process.env.AGENTE_TOKEN = 'tok'
  const chamadas: [string, RequestInit][] = []
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    chamadas.push([url, init])
    return Response.json({ mensagem: 'olá', acao: 'continuar', lead: {}, score: 0, temperatura: 'frio', etapa: 'novo' })
  })
  assert.equal((await consultarCerebro(pedido)).mensagem, 'olá')
  const [url, init] = chamadas[0]
  assert.equal(url, 'https://cerebro.test/responder')
  assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer tok')
  assert.deepEqual(JSON.parse(String(init.body)), pedido)
})

test('consultarCerebro falha alto em 401', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 401 }))
  await assert.rejects(consultarCerebro(pedido), /cérebro 401/)
})
```

- [ ] **Step 5: `web/lib/cerebro.ts`**

```ts
import type { Etapa, Lead, Temperatura, Turno } from './tipos.ts'

export type Pedido = { historico: Turno[]; lead: Lead; msgs_bot: number; telefone_conhecido: boolean }
export type Veredito = {
  mensagem: string
  acao: 'continuar' | 'encaminhar_humano' | 'encerrar'
  lead: Lead
  score: number
  temperatura: Temperatura
  etapa: Etapa
}

export async function consultarCerebro(p: Pedido): Promise<Veredito> {
  const r = await fetch(`${process.env.CEREBRO_URL}/responder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AGENTE_TOKEN}` },
    body: JSON.stringify(p),
    // Partida a frio do Python + LLM; acima disso o cliente recebe FALHA em vez de silêncio.
    signal: AbortSignal.timeout(40_000),
  })
  if (!r.ok) throw new Error(`cérebro ${r.status}: ${await r.text()}`)
  return (await r.json()) as Veredito
}
```

- [ ] **Step 6: teste que falha do fluxo** — `web/tests/fluxo.test.ts`

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Pedido, Veredito } from '../lib/cerebro.ts'
import { type Deps, FALHA, receber } from '../lib/fluxo.ts'
import type { Lead, Turno } from '../lib/tipos.ts'
import type { Evento } from '../lib/zapi.ts'

type Linha = { id: string; contato: string; autor: Turno['autor']; texto: string; respondida: boolean }
type Ficha = { phone: string; lead: Lead; pausado: boolean; temperatura?: string }

function montar(veredito: Partial<Veredito> | Error = {}) {
  const mensagens: Linha[] = []
  const contatos = new Map<string, Ficha>()
  const enviadas: { phone: string; texto: string }[] = []
  const pedidos: Pedido[] = []
  const d: Deps = {
    debounceMs: 0,
    esperar: () => new Promise((r) => setTimeout(r, 5)),
    enviar: async (phone, texto) => {
      enviadas.push({ phone, texto })
      return `BOT${enviadas.length}`
    },
    cerebro: async (p) => {
      pedidos.push(p)
      if (veredito instanceof Error) throw veredito
      return { mensagem: 'olá!', acao: 'continuar', lead: {}, score: 0, temperatura: 'frio', etapa: 'novo', ...veredito }
    },
    db: {
      async registrarMensagem(m) {
        if (mensagens.some((x) => x.id === m.id)) return false
        if (!contatos.has(m.contato)) contatos.set(m.contato, { phone: m.phone, lead: {}, pausado: false })
        mensagens.push({ id: m.id, contato: m.contato, autor: m.autor, texto: m.texto, respondida: m.autor !== 'cliente' })
        return true
      },
      async ultimaDoCliente(c) {
        return mensagens.filter((m) => m.contato === c && m.autor === 'cliente').at(-1)?.id ?? null
      },
      async reivindicarPendentes(c) {
        const p = mensagens.filter((m) => m.contato === c && m.autor === 'cliente' && !m.respondida)
        for (const m of p) m.respondida = true
        return p.length
      },
      async historico(c) {
        return mensagens.filter((m) => m.contato === c).map(({ autor, texto }) => ({ autor, texto }))
      },
      async carregarContato(id) {
        const c = contatos.get(id)
        if (!c) throw new Error(`contato ${id} não existe`)
        const msgsBot = mensagens.filter((m) => m.contato === id && m.autor === 'bot').length
        return { id, phone: c.phone, lead: c.lead, pausado: c.pausado, msgsBot }
      },
      async salvarLead(id, lead, _score, temp) {
        Object.assign(contatos.get(id) ?? {}, { lead, temperatura: temp })
      },
      async pausar(id) {
        Object.assign(contatos.get(id) ?? {}, { pausado: true })
      },
    },
  }
  return { d, mensagens, contatos, enviadas, pedidos }
}

const cliente = (id: string, texto = 'oi', phone = '5583999990000'): Evento => ({ tipo: 'cliente', id, contato: 'C1', phone, nome: 'Ana', texto })

test('três mensagens seguidas geram uma resposta só', async () => {
  const f = montar()
  await Promise.all([receber(cliente('1', 'oi'), f.d), receber(cliente('2', 'tudo bem?'), f.d), receber(cliente('3', 'quero automação'), f.d)])
  assert.equal(f.enviadas.length, 1)
  assert.deepEqual(f.pedidos[0].historico.map((t) => t.texto), ['oi', 'tudo bem?', 'quero automação'])
})

test('reentrega da mesma mensagem não responde de novo', async () => {
  const f = montar()
  await receber(cliente('1'), f.d)
  await receber(cliente('1'), f.d)
  assert.equal(f.enviadas.length, 1)
})

test('atendente respondendo pelo celular tira o bot da conversa', async () => {
  const f = montar()
  await receber({ tipo: 'humano', id: 'H1', contato: 'C1', phone: '5583999990000', texto: 'Oi, aqui é o Pedro' }, f.d)
  await receber(cliente('2'), f.d)
  assert.equal(f.enviadas.length, 0)
})

test('depois de encaminhar o bot para de responder', async () => {
  const f = montar({ acao: 'encaminhar_humano' })
  await receber(cliente('1'), f.d)
  await receber(cliente('2', 'e aí?'), f.d)
  assert.equal(f.enviadas.length, 1)
})

test('cérebro fora do ar manda mensagem de falha e pausa', async () => {
  const f = montar(new Error('cérebro 500'))
  await receber(cliente('1'), f.d)
  assert.deepEqual(f.enviadas, [{ phone: '5583999990000', texto: FALHA }])
  assert.equal(f.contatos.get('C1')?.pausado, true)
})

test('contato só com @lid avisa o cérebro que falta telefone', async () => {
  const f = montar()
  await receber(cliente('1', 'oi', '999@lid'), f.d)
  assert.equal(f.pedidos[0].telefone_conhecido, false)
})

test('veredito do cérebro é salvo e a resposta entra no histórico', async () => {
  const f = montar({ temperatura: 'quente', lead: { porte: 'ME' } })
  await receber(cliente('1'), f.d)
  assert.equal(f.contatos.get('C1')?.temperatura, 'quente')
  assert.deepEqual(f.mensagens.at(-1), { id: 'BOT1', contato: 'C1', autor: 'bot', texto: 'olá!', respondida: true })
})

test('evento ignorado não toca em nada', async () => {
  const f = montar()
  await receber({ tipo: 'ignorar' }, f.d)
  assert.equal(f.mensagens.length, 0)
})
```

- [ ] **Step 7: rodar e ver falhar**

Run: `cd web && npm test`
Expected: FAIL — `Cannot find module '.../lib/fluxo.ts'` (o `cerebro.test.ts` já passa)

- [ ] **Step 8: implementação** — `web/lib/fluxo.ts`

```ts
import type { consultarCerebro, Veredito } from './cerebro.ts'
import type * as banco from './db.ts'
import type { Evento } from './zapi.ts'

export type Deps = {
  db: Omit<typeof banco, 'sql'>
  cerebro: typeof consultarCerebro
  enviar: (phone: string, texto: string) => Promise<string>
  esperar: (ms: number) => Promise<void>
  debounceMs: number
}

export const HORAS_PAUSA = 24
export const FALHA =
  'Tive um problema técnico aqui. Um especialista da GeniAI vai continuar seu atendimento; o time responde das 8h às 17h.'

export async function receber(e: Evento, d: Deps): Promise<void> {
  if (e.tipo === 'ignorar') return
  const nova = await d.db.registrarMensagem({
    id: e.id, contato: e.contato, phone: e.phone, nome: e.tipo === 'cliente' ? e.nome : null, autor: e.tipo, texto: e.texto,
  })
  if (!nova) return
  if (e.tipo === 'humano') return d.db.pausar(e.contato, HORAS_PAUSA)

  await d.esperar(d.debounceMs)
  // Chegou outra mensagem durante a espera: quem responde é a espera dela.
  if ((await d.db.ultimaDoCliente(e.contato)) !== e.id) return
  await atender(e.contato, d)
}

async function atender(contatoId: string, d: Deps): Promise<void> {
  const c = await d.db.carregarContato(contatoId)
  if (c.pausado) return
  // Reivindicação atômica: se outra execução já pegou estas mensagens, esta desiste.
  if ((await d.db.reivindicarPendentes(contatoId)) === 0) return

  let v: Veredito | null = null
  try {
    v = await d.cerebro({
      historico: await d.db.historico(contatoId),
      lead: c.lead,
      msgs_bot: c.msgsBot,
      telefone_conhecido: !c.phone.endsWith('@lid'),
    })
  } catch (erro) {
    console.error('cérebro falhou', contatoId, erro)
  }

  const texto = v?.mensagem ?? FALHA
  // ponytail: se o send-text falhar, as mensagens já foram reivindicadas e ficam sem resposta; reenfileirar quando a Z-API falhar de verdade.
  const id = await d.enviar(c.phone, texto)
  await d.db.registrarMensagem({ id, contato: contatoId, phone: c.phone, autor: 'bot', texto })
  if (v) await d.db.salvarLead(contatoId, v.lead, v.score, v.temperatura, v.etapa)
  if (v?.acao !== 'continuar') await d.db.pausar(contatoId, HORAS_PAUSA)
}
```

- [ ] **Step 9: rodar e ver passar**

Run: `cd web && npm test && npm run lint && npx tsc --noEmit`
Expected: PASS em tudo.

- [ ] **Step 10: prova de vermelho** — remover `if ((await d.db.ultimaDoCliente(e.contato)) !== e.id) return`, rodar (deve falhar "três mensagens seguidas…"), desfazer.

- [ ] **Step 11: rota** — `web/app/api/webhook/[secret]/route.ts`

```ts
import { after } from 'next/server'
import { consultarCerebro } from '@/lib/cerebro.ts'
import * as db from '@/lib/db.ts'
import { receber } from '@/lib/fluxo.ts'
import { enviarTexto, lerEvento } from '@/lib/zapi.ts'

// Espera do debounce + partida a frio do cérebro + LLM + send-text.
export const maxDuration = 60

export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params
  // A Z-API não assina o webhook: o segredo no caminho é a única prova de origem.
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) return new Response(null, { status: 404 })
  const evento = lerEvento(await req.json().catch(() => null))
  after(() =>
    receber(evento, {
      db,
      cerebro: consultarCerebro,
      enviar: enviarTexto,
      esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
      debounceMs: Number(process.env.DEBOUNCE_MS ?? 6000),
    }),
  )
  return Response.json({ ok: true })
}
```

- [ ] **Step 12: `npm run build`** — verde.

- [ ] **Step 13: devolver ao pai para commit** — `feat(web): webhook da Z-API com debounce, dedupe e pausa quando humano assume`. Depois do commit, o pai roda `cd web && node --env-file=.env.local scripts/migrar.ts`.

---

### Task 8: dashboard com a identidade visual da GeniAI

**Files:**
- Create: `web/proxy.ts`, `web/app/leads/page.tsx`, `web/app/leads/[id]/page.tsx`
- Modify: `web/app/globals.css`, `web/app/layout.tsx`, `web/app/page.tsx` (substituir o conteúdo gerado)

**Interfaces:**
- Consumes: `sql()` de `lib/db.ts`; `ETAPAS`, `STATUS_COMERCIAL`, `type Lead` de `lib/tipos.ts`; tabelas da Tarefa 7; `public/geniai-icone.png` (Tarefa 1); tokens da tabela em Global Constraints. **Referência visual: `docs/marca/site-hero.png`.**
- Produces: `/` (visão geral), `/leads` (tabela com filtros), `/leads/[id]` (ficha, conversa e status comercial). Tudo atrás de basic auth, menos `/api/webhook`.

- [ ] **Step 1: `web/proxy.ts`** (Next 16: `middleware.ts` virou `proxy.ts`)

```ts
import { type NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const { DASHBOARD_USER, DASHBOARD_PASSWORD } = process.env
  // Sem senha configurada, fecha: o dashboard tem dado pessoal (LGPD).
  if (DASHBOARD_PASSWORD && req.headers.get('authorization') === `Basic ${btoa(`${DASHBOARD_USER}:${DASHBOARD_PASSWORD}`)}`) {
    return NextResponse.next()
  }
  return new NextResponse('Acesso restrito', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="GeniAI"' } })
}

export const config = { matcher: ['/((?!api/webhook|_next/static|_next/image|favicon.ico|geniai-icone.png).*)'] }
```

- [ ] **Step 2: `web/app/globals.css`** (substituir tudo)

```css
@import "tailwindcss";

@theme {
  --color-fundo: #010f17;
  --color-superficie: rgb(255 255 255 / 0.05);
  --color-borda: rgb(255 255 255 / 0.1);
  --color-texto: #d9d9d9;
  --color-suave: rgb(163 191 255 / 0.62);
  --color-azul: #0099ff;
  --color-ciano: #00c0fa;
  --color-quente: #ff7a59;
  --color-morno: #f5c451;
  --color-frio: #0daadf;
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --radius-cartao: 18px;
}

/* Gradientes tirados do site: botão "Agendar diagnóstico" e ícone do logo. */
.botao-primario {
  background: linear-gradient(96deg, #0069ab 0%, #07afb5 150%);
  border-radius: 100px;
  color: #fff;
}
.gradiente-marca {
  background: linear-gradient(90deg, #0daadf, #08fbd0);
}
.cartao {
  background: var(--color-superficie);
  border: 1px solid var(--color-borda);
  border-radius: var(--radius-cartao);
}
```

- [ ] **Step 3: `web/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Image from 'next/image'
import Link from 'next/link'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = { title: 'GeniAI · Leads' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen bg-fundo font-sans text-texto antialiased">
        <header className="border-b border-borda">
          <nav className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/geniai-icone.png" alt="" width={28} height={28} />
              <span className="text-xl font-medium tracking-tight">geniAI</span>
            </Link>
            <Link href="/" className="text-sm text-suave hover:text-white">Visão geral</Link>
            <Link href="/leads" className="text-sm text-suave hover:text-white">Leads</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: `web/app/page.tsx`** (visão geral)

```tsx
import { sql } from '@/lib/db.ts'
import { ETAPAS } from '@/lib/tipos.ts'

export const dynamic = 'force-dynamic'

const FRANQUIA_META = 1000
const PRECO_MENSAGEM_META = 0.035

export default async function VisaoGeral() {
  const db = sql()
  const [[t], etapas, [m], dias] = await Promise.all([
    db`select count(*)::int as leads,
        count(*) filter (where temperatura = 'quente')::int as quente,
        count(*) filter (where temperatura = 'morno')::int as morno,
        count(*) filter (where temperatura = 'frio')::int as frio
      from contatos`,
    db`select etapa, count(*)::int as n from contatos group by etapa`,
    db`select count(*) filter (where autor = 'bot')::int as bot,
        count(distinct contato_id) filter (where autor = 'bot')::int as conversas,
        count(*) filter (where autor <> 'cliente' and criado_em >= date_trunc('month', now()))::int as empresa_mes
      from mensagens`,
    db`select to_char(d, 'DD/MM') as dia, count(c.id)::int as n
      from generate_series((now() at time zone 'America/Fortaleza')::date - 13,
                           (now() at time zone 'America/Fortaleza')::date, interval '1 day') d
      left join contatos c on (c.criado_em at time zone 'America/Fortaleza')::date = d::date
      group by d order by d`,
  ])
  const porEtapa: Record<string, number> = Object.fromEntries(etapas.map((e) => [e.etapa, e.n]))
  const maxEtapa = Math.max(1, ...Object.values(porEtapa))
  const maxDia = Math.max(1, ...dias.map((d) => d.n as number))
  const msgsPorConversa = m.conversas ? (m.bot / m.conversas).toFixed(1) : '—'
  const custoMeta = Math.max(0, m.empresa_mes - FRANQUIA_META) * PRECO_MENSAGEM_META

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-normal tracking-[-0.066em] sm:text-5xl">Leads da GeniAI</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cartao rotulo="Leads" valor={t.leads} />
        <Cartao rotulo="Quentes" valor={t.quente} destaque />
        <Cartao rotulo="Msgs do bot por conversa" valor={msgsPorConversa} />
        <Cartao
          rotulo="Custo equivalente na API oficial (mês)"
          valor={custoMeta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        />
      </section>

      <section className="cartao p-5">
        <h2 className="mb-4 font-medium">Funil</h2>
        {ETAPAS.map((e) => (
          <Barra key={e} rotulo={e} n={porEtapa[e] ?? 0} max={maxEtapa} cor="gradiente-marca" />
        ))}
      </section>

      <section className="cartao p-5">
        <h2 className="mb-4 font-medium">Temperatura</h2>
        <Barra rotulo="quente" n={t.quente} max={Math.max(1, t.leads)} cor="bg-quente" />
        <Barra rotulo="morno" n={t.morno} max={Math.max(1, t.leads)} cor="bg-morno" />
        <Barra rotulo="frio" n={t.frio} max={Math.max(1, t.leads)} cor="bg-frio" />
      </section>

      <section className="cartao p-5">
        <h2 className="mb-4 font-medium">Novos leads · 14 dias</h2>
        <div className="flex h-36 items-end gap-1">
          {dias.map((d) => (
            <div key={d.dia} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.dia}: ${d.n}`}>
              <div className="gradiente-marca w-full rounded-t" style={{ height: `${(d.n / maxDia) * 100}%` }} />
              <span className="text-[10px] text-suave">{d.dia}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Cartao({ rotulo, valor, destaque }: { rotulo: string; valor: string | number; destaque?: boolean }) {
  return (
    <div className={`cartao p-4 ${destaque ? 'border-quente/40' : ''}`}>
      <div className={`text-3xl font-normal tracking-[-0.05em] ${destaque ? 'text-quente' : 'text-white'}`}>{valor}</div>
      <div className="mt-1 text-sm text-suave">{rotulo}</div>
    </div>
  )
}

function Barra({ rotulo, n, max, cor }: { rotulo: string; n: number; max: number; cor: string }) {
  return (
    <div className="mb-2 flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-suave">{rotulo}</span>
      <div className="h-2.5 flex-1 rounded-full bg-superficie">
        <div className={`h-2.5 rounded-full ${cor}`} style={{ width: `${(n / max) * 100}%` }} />
      </div>
      <span className="w-8 text-right tabular-nums">{n}</span>
    </div>
  )
}
```

- [ ] **Step 5: `web/app/leads/page.tsx`**

```tsx
import Link from 'next/link'
import { sql } from '@/lib/db.ts'
import { ETAPAS, STATUS_COMERCIAL } from '@/lib/tipos.ts'

export const dynamic = 'force-dynamic'

type Filtros = { temperatura?: string; etapa?: string; status?: string }

const COR_TEMPERATURA: Record<string, string> = {
  quente: 'bg-quente/15 text-quente',
  morno: 'bg-morno/15 text-morno',
  frio: 'bg-frio/15 text-frio',
}

export default async function Leads({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams
  const temp = f.temperatura || null
  const et = f.etapa || null
  const st = f.status || null
  const leads = await sql()`select id, phone, nome_whatsapp, lead->>'nome' as nome, lead->>'empresa' as empresa,
      lead->>'porte' as porte, score, temperatura, etapa, status_comercial
    from contatos
    where (${temp}::text is null or temperatura = ${temp})
      and (${et}::text is null or etapa = ${et})
      and (${st}::text is null or status_comercial = ${st})
    order by score desc, atualizado_em desc limit 200`

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-normal tracking-[-0.066em]">Leads</h1>
      <form className="flex flex-wrap gap-2 text-sm">
        <Seletor nome="temperatura" valor={temp} opcoes={['quente', 'morno', 'frio']} />
        <Seletor nome="etapa" valor={et} opcoes={ETAPAS} />
        <Seletor nome="status" valor={st} opcoes={STATUS_COMERCIAL} />
        <button type="submit" className="botao-primario px-4 py-1.5">Filtrar</button>
      </form>
      <div className="cartao overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-borda text-suave">
            <tr>
              <th className="px-4 py-3 font-normal">Lead</th>
              <th className="font-normal">Porte</th>
              <th className="font-normal">Score</th>
              <th className="font-normal">Temperatura</th>
              <th className="font-normal">Etapa</th>
              <th className="font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-borda last:border-0 hover:bg-superficie">
                <td className="px-4 py-3">
                  <Link className="font-medium text-white hover:text-ciano" href={`/leads/${encodeURIComponent(l.id)}`}>
                    {l.nome ?? l.nome_whatsapp ?? l.phone}
                  </Link>
                  <div className="text-suave">{l.empresa ?? ''}</div>
                </td>
                <td>{l.porte ?? '—'}</td>
                <td className="tabular-nums">{l.score}</td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${COR_TEMPERATURA[l.temperatura] ?? ''}`}>{l.temperatura}</span>
                </td>
                <td>{l.etapa}</td>
                <td>{l.status_comercial}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && <p className="py-10 text-center text-suave">Nenhum lead com esses filtros.</p>}
      </div>
    </div>
  )
}

function Seletor({ nome, valor, opcoes }: { nome: string; valor: string | null; opcoes: readonly string[] }) {
  return (
    <select name={nome} defaultValue={valor ?? ''} className="rounded-full border border-borda bg-fundo px-3 py-1.5">
      <option value="">{nome}: todas</option>
      {opcoes.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}
```

- [ ] **Step 6: `web/app/leads/[id]/page.tsx`**

```tsx
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { sql } from '@/lib/db.ts'
import { STATUS_COMERCIAL } from '@/lib/tipos.ts'

export const dynamic = 'force-dynamic'

async function mudarStatus(form: FormData) {
  'use server'
  const id = String(form.get('id'))
  const status = String(form.get('status'))
  if (!(STATUS_COMERCIAL as readonly string[]).includes(status)) throw new Error(`status inválido: ${status}`)
  await sql()`update contatos set status_comercial = ${status} where id = ${id}`
  revalidatePath(`/leads/${encodeURIComponent(id)}`)
}

export default async function FichaLead({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id)
  const [c] = await sql()`select * from contatos where id = ${id}`
  if (!c) notFound()
  const mensagens = await sql()`select autor, texto, criado_em from mensagens where contato_id = ${id} order by criado_em`
  const lead = c.lead as Record<string, unknown>
  const telefone = /^\d+$/.test(c.phone) ? c.phone : (lead.telefone as string | null)

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
      <section className="cartao space-y-4 p-5">
        <h1 className="text-3xl font-normal tracking-[-0.05em] text-white">{(lead.nome as string) ?? c.nome_whatsapp ?? c.phone}</h1>
        <p className="text-sm text-suave">
          {c.temperatura} · score {c.score} · {c.etapa}
          {telefone && (
            <>
              {' · '}
              <a className="text-ciano" href={`https://wa.me/${telefone.replace(/\D/g, '')}`}>{telefone}</a>
            </>
          )}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {Object.entries(lead).map(([campo, valor]) => (
            <div key={campo} className="contents">
              <dt className="text-suave">{campo}</dt>
              <dd>{Array.isArray(valor) ? valor.join(', ') || '—' : String(valor ?? '—')}</dd>
            </div>
          ))}
        </dl>
        <form action={mudarStatus} className="flex gap-2 text-sm">
          <input type="hidden" name="id" value={id} />
          <select name="status" defaultValue={c.status_comercial} className="rounded-full border border-borda bg-fundo px-3 py-1.5">
            {STATUS_COMERCIAL.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button type="submit" className="botao-primario px-4 py-1.5">Salvar status</button>
        </form>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Conversa</h2>
        {mensagens.map((m, i) => (
          <div
            key={`${m.criado_em}-${i}`}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl p-3 text-sm ${
              m.autor === 'cliente' ? 'cartao' : 'ml-auto border border-ciano/30 bg-ciano/10'
            }`}
          >
            <div className="mb-1 text-[10px] uppercase tracking-wide text-suave">{m.autor}</div>
            {m.texto}
          </div>
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 7: checar**

Run: `cd web && npm run lint && npx tsc --noEmit && npm run build && npm test`
Depois `npm run dev` e, com `set -a; source .env.local; set +a`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/                                                # 401
curl -s -o /dev/null -w '%{http_code}\n' -u "$DASHBOARD_USER:$DASHBOARD_PASSWORD" localhost:3000/          # 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/webhook/errado                        # 404
```

Comparar visualmente com `docs/marca/site-hero.png`: `playwright-cli open http://geniai:<senha>@localhost:3000`, depois `playwright-cli screenshot --filename=/tmp/dash.png`, e ler a imagem. Fundo, cartões, fonte e gradientes devem parecer do mesmo site.

- [ ] **Step 8: devolver ao pai para commit** — `feat(web): dashboard de leads com a identidade visual da GeniAI`

---

### Task 9: Z-API + deploy + ponta a ponta (agente pai + usuário)

- [ ] **Step 1:** o usuário cria a instância na Z-API e conecta o chip dedicado pelo QR code (nunca o número pessoal). Gera o **token de segurança da conta** e passa `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN` e `ZAPI_CLIENT_TOKEN`. Cada um vai para o projeto `geniai-web` com `! vercel env add …`, e depois `vercel env pull .env.local`. Ativar o token no painel da Z-API **só depois** do envio do Step 4 funcionar.
- [ ] **Step 2:** `git push` publica os dois projetos. Conferir `vercel ls` em `web/` e em `cerebro/`.
- [ ] **Step 3:** apontar os webhooks

```bash
cd ~/geniai-agente/web && set -a && source .env.local && set +a
BASE="https://api.z-api.io/instances/$ZAPI_INSTANCE_ID/token/$ZAPI_TOKEN"
curl -s -X PUT "$BASE/update-webhook-received" -H "Client-Token: $ZAPI_CLIENT_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"value\":\"https://geniai-web.vercel.app/api/webhook/$WEBHOOK_SECRET\"}"
curl -s -X PUT "$BASE/update-notify-sent-by-me" -H "Client-Token: $ZAPI_CLIENT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"notifySentByMe":true}'
```

- [ ] **Step 4:** ponta a ponta. De outro celular, mandar "oi", "tudo bem?" e "queria saber de automação" em menos de 6 s. Deve chegar **1** resposta. Seguir até o encaminhamento, conferir o lead em `/leads` e os três `curl` de status da spec.

---

### Task 10: fecho (agente pai)

- [ ] Rodar todo o critério de aceite da spec e colar a saída.
- [ ] Convergência: cada item da Intenção apontado no diff.
- [ ] `code-review` nível `medium` no branch; cada achado passa por `receiving-code-review`.
- [ ] README final:
  - o que é, em 2 linhas, e a arquitetura em 5 linhas (web ↔ cérebro)
  - a **saída real** de `python -m agente.avaliar`
  - como rodar local: `uv sync --extra dev`, `vercel env pull`, `npm run dev`, `uv run --env-file .env python -m agente.chat`
  - a configuração da Z-API (os dois `curl` da Tarefa 9)
  - de onde vem o que a Gê diz (`docs/respostas-geniai.md`) e o que ainda falta confirmar com a GeniAI: periodicidade da cobrança do Audiobot, corte `BASE_RELEVANTE` e plano Hobby da Vercel antes de produção
