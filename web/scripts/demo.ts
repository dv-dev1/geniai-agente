import { readFileSync } from 'node:fs'
import { Pool } from '@neondatabase/serverless'
import { ETAPAS, type Etapa } from '../lib/tipos.ts'

// Dados fictícios para ver o dashboard cheio. Só roda no banco geniai_demo: produção guarda leads reais.
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const { rows } = await pool.query('select current_database() as db')
if (rows[0].db !== 'geniai_demo') throw new Error(`recusado: banco ${rows[0].db}, esperado geniai_demo`)
await pool.query(readFileSync('db/schema.sql', 'utf8'))

type Perfil = {
  nome: string
  empresa: string
  cidade: string
  porte: string
  pessoas: number
  dor: string
  produto: 'audiobot' | 'disparador'
}

const PERFIS: Perfil[] = [
  {
    nome: 'Marcos',
    empresa: 'Sabor do Mar',
    cidade: 'Recife',
    porte: 'ME',
    pessoas: 12,
    dor: 'acompanhar o que acontece na cozinha',
    produto: 'audiobot',
  },
  {
    nome: 'Renata',
    empresa: 'Clínica Sorriso Pleno',
    cidade: 'João Pessoa',
    porte: 'EPP',
    pessoas: 20,
    dor: 'melhorar o atendimento da recepção',
    produto: 'audiobot',
  },
  {
    nome: 'Roberto',
    empresa: 'Distribuidora Nordeste Bebidas',
    cidade: 'Campina Grande',
    porte: 'grande',
    pessoas: 300,
    dor: 'avisar os clientes das promoções',
    produto: 'disparador',
  },
  {
    nome: 'Paula',
    empresa: 'Rede Casa Bela',
    cidade: 'Natal',
    porte: 'media',
    pessoas: 80,
    dor: 'divulgar ofertas sem mandar uma a uma',
    produto: 'disparador',
  },
  {
    nome: 'Júlio',
    empresa: 'Academia Força Total',
    cidade: 'João Pessoa',
    porte: 'ME',
    pessoas: 9,
    dor: 'lembrar os alunos das mensalidades',
    produto: 'disparador',
  },
  {
    nome: 'Fernanda',
    empresa: 'Studio Fê Beleza',
    cidade: 'Cabedelo',
    porte: 'MEI',
    pessoas: 1,
    dor: 'confirmar os horários das clientes',
    produto: 'disparador',
  },
  {
    nome: 'Ricardo',
    empresa: 'Auto Peças Veloz',
    cidade: 'Recife',
    porte: 'EPP',
    pessoas: 25,
    dor: 'saber como os vendedores atendem no balcão',
    produto: 'audiobot',
  },
  {
    nome: 'Camila',
    empresa: 'Escola Pequeno Saber',
    cidade: 'João Pessoa',
    porte: 'EPP',
    pessoas: 40,
    dor: 'avisar os pais sobre eventos',
    produto: 'disparador',
  },
  {
    nome: 'André',
    empresa: 'Padaria Pão Quente',
    cidade: 'Bayeux',
    porte: 'ME',
    pessoas: 7,
    dor: 'acompanhar o caixa quando não está',
    produto: 'audiobot',
  },
  {
    nome: 'Luciana',
    empresa: 'Imobiliária Lar Certo',
    cidade: 'Natal',
    porte: 'EPP',
    pessoas: 18,
    dor: 'reativar clientes antigos',
    produto: 'disparador',
  },
  {
    nome: 'Thiago',
    empresa: 'Hotel Brisa Mar',
    cidade: 'Maceió',
    porte: 'media',
    pessoas: 60,
    dor: 'avaliar o atendimento da recepção',
    produto: 'audiobot',
  },
  {
    nome: 'Beatriz',
    empresa: 'Farmácia Vida',
    cidade: 'João Pessoa',
    porte: 'ME',
    pessoas: 8,
    dor: 'avisar sobre remédios de uso contínuo',
    produto: 'disparador',
  },
  {
    nome: 'Gustavo',
    empresa: 'Construtora Alicerce',
    cidade: 'Campina Grande',
    porte: 'media',
    pessoas: 120,
    dor: 'registrar as reuniões de obra',
    produto: 'audiobot',
  },
  {
    nome: 'Patrícia',
    empresa: 'Pet Shop Amigo Fiel',
    cidade: 'Recife',
    porte: 'ME',
    pessoas: 6,
    dor: 'lembrar os clientes do banho e tosa',
    produto: 'disparador',
  },
  {
    nome: 'Eduardo',
    empresa: 'Restaurante Engenho',
    cidade: 'João Pessoa',
    porte: 'EPP',
    pessoas: 30,
    dor: 'acompanhar o salão nos horários de pico',
    produto: 'audiobot',
  },
  {
    nome: 'Aline',
    empresa: 'Loja Moda Leve',
    cidade: 'Natal',
    porte: 'ME',
    pessoas: 5,
    dor: 'divulgar a coleção nova',
    produto: 'disparador',
  },
  {
    nome: 'Rafael',
    empresa: 'Oficina Motor Bom',
    cidade: 'Santa Rita',
    porte: 'MEI',
    pessoas: 2,
    dor: 'entender IA para a oficina',
    produto: 'audiobot',
  },
  {
    nome: 'Juliana',
    empresa: 'Clínica Bem Estar',
    cidade: 'Recife',
    porte: 'EPP',
    pessoas: 22,
    dor: 'confirmar consultas e reduzir faltas',
    produto: 'disparador',
  },
  {
    nome: 'Felipe',
    empresa: 'Supermercado Economia',
    cidade: 'João Pessoa',
    porte: 'media',
    pessoas: 95,
    dor: 'acompanhar o atendimento dos caixas',
    produto: 'audiobot',
  },
  {
    nome: 'Mariana',
    empresa: 'Doceria Açúcar Fino',
    cidade: 'Cabedelo',
    porte: 'MEI',
    pessoas: 1,
    dor: 'avisar as clientes das encomendas',
    produto: 'disparador',
  },
]

// Etapa e status de cada lead (a prioridade sai da pontuação): a mistura que um mês real de pré-vendas costuma ter.
const CENARIOS: [etapa: string, status: string][] = [
  ['encaminhado', 'reuniao'],
  ['encaminhado', 'fechado'],
  ['encaminhado', 'a_contatar'],
  ['interesse', 'a_contatar'],
  ['encaminhado', 'contatado'],
  ['interesse', 'a_contatar'],
  ['apresentacao', 'a_contatar'],
  ['encaminhado', 'a_contatar'],
  ['triagem', 'a_contatar'],
  ['interesse', 'contatado'],
  ['encaminhado', 'reuniao'],
  ['apresentacao', 'a_contatar'],
  ['encaminhado', 'fechado'],
  ['triagem', 'a_contatar'],
  ['interesse', 'a_contatar'],
  ['novo', 'a_contatar'],
  ['perdido', 'perdido'],
  ['encaminhado', 'a_contatar'],
  ['interesse', 'perdido'],
  ['apresentacao', 'a_contatar'],
]
const PLANOS = ['inicial', 'padrao', 'premium']
const URGENCIAS = ['imediata', 'ate_3_meses', 'sem_pressa']
const PONTOS_PORTE: Record<string, number> = { MEI: 5, ME: 10, EPP: 15, media: 15, grande: 15 }

function montarLead(p: Perfil, etapa: string, i: number) {
  const passou = (e: string) => etapa !== 'perdido' && ETAPAS.indexOf(etapa as Etapa) >= ETAPAS.indexOf(e as Etapa)
  const encaminhado = etapa === 'encaminhado'
  const lead = {
    nome: passou('triagem') ? p.nome : null,
    empresa: passou('triagem') ? p.empresa : null,
    cidade: encaminhado ? p.cidade : null,
    porte: passou('triagem') && i % 3 !== 0 ? p.porte : null,
    colaboradores: passou('triagem') ? p.pessoas : null,
    dor: passou('apresentacao') ? p.dor : null,
    servicos: passou('interesse') ? [p.produto] : [],
    plano: passou('interesse') && p.produto === 'audiobot' ? PLANOS[i % 3] : null,
    base_clientes: passou('interesse') && p.produto === 'disparador' ? [800, 2500, 12000, 50000][i % 4] : null,
    urgencia: encaminhado ? URGENCIAS[i % 3] : null,
    decisor: encaminhado ? i % 4 !== 0 : null,
    telefone: null,
    pediu_contato: encaminhado,
    fora_do_perfil: etapa === 'perdido' ? true : null,
    resumo: passou('triagem')
      ? `${p.nome}, da ${p.empresa} (${p.pessoas} ${p.pessoas === 1 ? 'pessoa' : 'pessoas'}), quer ${p.dor}. ${
          encaminhado
            ? `Interessado no ${p.produto === 'audiobot' ? 'Audiobot' : 'Disparador'}; pediu para falar com um especialista.`
            : 'Ainda conhecendo as soluções da GeniAI.'
        }`
      : null,
  }
  if (etapa === 'perdido') {
    Object.assign(lead, { nome: p.nome, resumo: `${p.nome} procurava vaga de emprego; fora do perfil de cliente.` })
  }
  // Mesmas regras do cérebro (cerebro/agente/lead.py), para a pontuação bater com o que a Gê calcularia.
  let score = 0
  if (!lead.fora_do_perfil) {
    score += lead.porte ? PONTOS_PORTE[lead.porte] : lead.colaboradores == null ? 0 : lead.colaboradores < 10 ? 10 : 15
    if (lead.colaboradores != null) score += lead.colaboradores >= 10 ? 10 : 5
    if (lead.dor) score += 15
    if (lead.servicos.length) score += 15
    if (lead.plano || (lead.base_clientes ?? 0) >= 500) score += 15
    score += lead.urgencia === 'imediata' ? 15 : lead.urgencia === 'ate_3_meses' ? 10 : 0
    if (lead.decisor) score += 10
    if (lead.pediu_contato) score = Math.max(score, 70)
  }
  const temperatura = score >= 70 ? 'quente' : score >= 40 ? 'morno' : 'frio'
  return { lead, score, temperatura }
}

function conversa(p: Perfil, etapa: string): [autor: string, texto: string][] {
  const produto = p.produto === 'audiobot' ? 'Audiobot' : 'Disparador'
  const falas: [string, string][] = [
    ['cliente', 'Oi, boa tarde'],
    ['bot', 'Olá! Sou a Gê, da GeniAI. Seus dados ficam só neste atendimento. Qual seu nome e o nome da sua empresa?'],
  ]
  if (etapa === 'novo') return falas
  if (etapa === 'perdido')
    return [
      ...falas,
      ['cliente', `Sou ${p.nome}, queria saber se vocês estão contratando`],
      [
        'bot',
        'Obrigada pelo interesse! Aqui eu atendo só empresas que querem conhecer as soluções da GeniAI. Vagas saem no nosso site.',
      ],
    ]
  falas.push([
    'cliente',
    `Sou ${p.nome}, da ${p.empresa}. Somos ${p.pessoas} ${p.pessoas === 1 ? 'pessoa' : 'pessoas'}.`,
  ])
  falas.push(['bot', `Prazer, ${p.nome}! O que você gostaria de resolver na ${p.empresa}?`])
  if (etapa === 'triagem') return falas
  falas.push(['cliente', `Queria ${p.dor}`])
  falas.push([
    'bot',
    `Entendi. Para isso o *${produto}* costuma ajudar bastante. Quer saber como funciona e quanto custa?`,
  ])
  if (etapa === 'apresentacao') return falas
  falas.push(['cliente', 'Quero sim, quanto fica?'])
  falas.push([
    'bot',
    `Te passo o valor do ${produto} para o seu caso. Quer falar com um especialista para ver os detalhes?`,
  ])
  if (etapa === 'interesse') return falas
  falas.push(['cliente', 'Quero'])
  falas.push(['bot', 'Ótimo! Em que cidade fica a empresa, para quando pensa em começar e você é quem decide?'])
  falas.push(['cliente', `${p.cidade}, quero começar logo e sou eu que decido`])
  falas.push(['bot', 'Obrigada! Vou passar sua conversa para um especialista da GeniAI, que responde das 8h às 17h.'])
  return falas
}

if (PERFIS.length !== CENARIOS.length) throw new Error('cada perfil precisa de um cenário')
const agora = Date.now()
// Numa transação só: se falhar no meio, o banco demo fica como estava, não pela metade.
const db = await pool.connect()
await db.query('begin')
await db.query('truncate mensagens, contatos')
for (const [i, p] of PERFIS.entries()) {
  const [etapa, status] = CENARIOS[i]
  const { lead, score, temperatura } = montarLead(p, etapa, i)
  const id = `demo-${i + 1}@lid`
  const inicio = new Date(agora - ((i * 5) % 13) * 86_400_000 - (i % 5) * 3_600_000)
  const falas = conversa(p, etapa)
  const fim = new Date(inicio.getTime() + falas.length * 90_000)
  await db.query(
    `insert into contatos (id, phone, nome_whatsapp, lead, score, temperatura, etapa, status_comercial, criado_em, atualizado_em, sessao_inicio, encerrada_em)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, $11)`,
    [
      id,
      `558399${String(1000000 + i * 137).padStart(7, '0')}`,
      p.nome,
      lead,
      score,
      temperatura,
      etapa,
      status,
      inicio,
      fim,
      etapa === 'encaminhado' || etapa === 'perdido' ? fim : null,
    ],
  )
  for (const [j, [autor, texto]] of falas.entries()) {
    await db.query(
      'insert into mensagens (id, contato_id, autor, texto, respondida, criado_em) values ($1, $2, $3, $4, true, $5)',
      [`${id}-${j}`, id, autor, texto, new Date(inicio.getTime() + j * 90_000)],
    )
  }
}
await db.query('commit')
db.release()
await pool.end()
console.log(`${PERFIS.length} leads fictícios no geniai_demo`)
