import { readFileSync } from 'node:fs'
import { Pool } from '@neondatabase/serverless'
import { type Etapa, ETAPAS } from '../lib/tipos.ts'

// Dados fictícios para apresentação. Só roda no banco geniai_demo: produção guarda leads reais.
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const { rows } = await pool.query('select current_database() as db')
if (rows[0].db !== 'geniai_demo') throw new Error(`recusado: banco ${rows[0].db}, esperado geniai_demo`)
await pool.query(readFileSync('db/schema.sql', 'utf8'))

type Produto = 'audiobot' | 'disparador'
type Negocio = { tipo: string; dor: string; produto: Produto; ambiente?: string }

const NEGOCIOS: Negocio[] = [
  { tipo: 'Restaurante', dor: 'acompanhar o que acontece na cozinha', produto: 'audiobot', ambiente: 'a cozinha' },
  {
    tipo: 'Clínica odontológica',
    dor: 'melhorar o atendimento da recepção',
    produto: 'audiobot',
    ambiente: 'a recepção',
  },
  { tipo: 'Distribuidora', dor: 'avisar os clientes das promoções da semana', produto: 'disparador' },
  { tipo: 'Rede de lojas', dor: 'divulgar ofertas sem mandar uma a uma', produto: 'disparador' },
  { tipo: 'Academia', dor: 'lembrar os alunos do vencimento da mensalidade', produto: 'disparador' },
  { tipo: 'Salão de beleza', dor: 'confirmar os horários das clientes', produto: 'disparador' },
  { tipo: 'Auto peças', dor: 'saber como os vendedores atendem no balcão', produto: 'audiobot', ambiente: 'o balcão' },
  { tipo: 'Escola', dor: 'avisar os pais sobre eventos e reuniões', produto: 'disparador' },
  { tipo: 'Padaria', dor: 'acompanhar o caixa quando não está na loja', produto: 'audiobot', ambiente: 'o caixa' },
  { tipo: 'Imobiliária', dor: 'reativar clientes que pararam de responder', produto: 'disparador' },
  { tipo: 'Hotel', dor: 'avaliar o atendimento da recepção', produto: 'audiobot', ambiente: 'a recepção' },
  { tipo: 'Farmácia', dor: 'avisar sobre remédios de uso contínuo', produto: 'disparador' },
  { tipo: 'Construtora', dor: 'registrar as reuniões de obra', produto: 'audiobot', ambiente: 'a sala de reuniões' },
  { tipo: 'Pet shop', dor: 'lembrar os clientes do banho e tosa', produto: 'disparador' },
  {
    tipo: 'Supermercado',
    dor: 'acompanhar o atendimento dos caixas',
    produto: 'audiobot',
    ambiente: 'a frente de caixa',
  },
  {
    tipo: 'Escritório de contabilidade',
    dor: 'registrar as reuniões com clientes',
    produto: 'audiobot',
    ambiente: 'a sala de reuniões',
  },
]
const NOMES = [
  'Marcos',
  'Renata',
  'Roberto',
  'Paula',
  'Júlio',
  'Fernanda',
  'Ricardo',
  'Camila',
  'André',
  'Luciana',
  'Thiago',
  'Beatriz',
  'Gustavo',
  'Patrícia',
  'Eduardo',
  'Aline',
  'Rafael',
  'Juliana',
  'Felipe',
  'Mariana',
  'Bruno',
  'Larissa',
  'Diego',
  'Vanessa',
  'Leonardo',
  'Carolina',
  'Henrique',
  'Tatiane',
  'Rodrigo',
  'Priscila',
  'Fábio',
  'Daniela',
  'Sérgio',
  'Gabriela',
  'Otávio',
  'Letícia',
  'Vinícius',
  'Natália',
  'Caio',
  'Simone',
  'Igor',
  'Helena',
  'Murilo',
  'Bianca',
  'Wesley',
  'Raquel',
  'Artur',
  'Sabrina',
]
const MARCAS = [
  'Sabor do Mar',
  'Sorriso Pleno',
  'Nordeste Bebidas',
  'Casa Bela',
  'Força Total',
  'Fê Beleza',
  'Veloz',
  'Pequeno Saber',
  'Pão Quente',
  'Lar Certo',
  'Brisa Mar',
  'Vida',
  'Alicerce',
  'Amigo Fiel',
  'Economia',
  'Conta Certa',
  'Engenho',
  'Moda Leve',
  'Bem Estar',
  'Açúcar Fino',
  'Ponta Verde',
  'Sol Nascente',
  'Mangue',
  'Cajueiro',
  'Tambaú',
  'Litoral',
  'Serra Azul',
  'Bom Preço',
  'Santa Luzia',
  'Arvoredo',
  'Maré Alta',
  'Cabo Branco',
  'Jardim',
  'Estrela',
  'Bela Vista',
  'Horizonte',
  'Aurora',
  'Oásis',
  'Primavera',
  'Farol',
  'Coqueiral',
  'Recanto',
  'Nova Era',
  'Galeria',
  'Sertão',
  'Brisa',
  'Atlântico',
  'Pérola',
]
const CIDADES = ['João Pessoa', 'Recife', 'Natal', 'Campina Grande', 'Cabedelo', 'Maceió', 'Caruaru', 'Mossoró']
const PORTES = [
  ['MEI', 1],
  ['ME', 6],
  ['ME', 9],
  ['EPP', 18],
  ['EPP', 35],
  ['media', 80],
  ['media', 140],
  ['grande', 320],
] as const
const PLANO = [
  { chave: 'inicial', nome: 'Inicial', preco: 'R$ 299', horas: 4 },
  { chave: 'padrao', nome: 'Padrão', preco: 'R$ 399', horas: 8 },
  { chave: 'premium', nome: 'Premium', preco: 'R$ 799', horas: 24 },
]
const URGENCIA = [
  ['imediata', 'quero começar já'],
  ['ate_3_meses', 'nos próximos dois meses'],
  ['sem_pressa', 'sem pressa, estou pesquisando'],
] as const
const PONTOS_PORTE: Record<string, number> = { MEI: 5, ME: 10, EPP: 15, media: 15, grande: 15 }

// Etapa mais distante e status comercial; a mistura imita um funil real (muita gente para no meio).
const CENARIOS: [Etapa, string][] = [
  ...Array(14).fill(['encaminhado', 'a_contatar']),
  ...Array(5).fill(['encaminhado', 'contatado']),
  ...Array(4).fill(['encaminhado', 'reuniao']),
  ...Array(4).fill(['encaminhado', 'fechado']),
  ...Array(7).fill(['interesse', 'a_contatar']),
  ['interesse', 'perdido'],
  ...Array(5).fill(['apresentacao', 'a_contatar']),
  ...Array(4).fill(['triagem', 'a_contatar']),
  ...Array(2).fill(['novo', 'a_contatar']),
  ...Array(2).fill(['perdido', 'perdido']),
]
if (NOMES.length !== CENARIOS.length || MARCAS.length !== NOMES.length) throw new Error('nomes, marcas e cenários')

type Fala = [autor: 'cliente' | 'bot' | 'humano', texto: string, minutos: number]
const maiuscula = (s: string) => s[0].toUpperCase() + s.slice(1)

function montar(i: number) {
  const [etapa, status] = CENARIOS[(i * 17) % CENARIOS.length]
  const n = NEGOCIOS[i % NEGOCIOS.length]
  const nome = NOMES[i]
  const empresa = `${n.tipo} ${MARCAS[i]}`
  const [porte, pessoas] = PORTES[(i * 5) % PORTES.length]
  const cidade = CIDADES[(i * 3) % CIDADES.length]
  const plano = PLANO[i % 3]
  const [urgencia, urgenciaFala] = URGENCIA[i % 3]
  const base = [800, 2500, 12000, 50000][i % 4]
  const produto = n.produto === 'audiobot' ? 'Audiobot' : 'Disparador'
  const passou = (e: Etapa) => etapa !== 'perdido' && ETAPAS.indexOf(etapa) >= ETAPAS.indexOf(e)
  const encaminhado = etapa === 'encaminhado'
  const decisor = encaminhado ? i % 4 !== 0 : null
  const dizPorte = i % 3 !== 0

  const falas: Fala[] = [
    ['cliente', ['Oi, boa tarde', 'Olá!', 'Bom dia, tudo bem?', 'Oi, vi o anúncio de vocês'][i % 4], 0],
    [
      'bot',
      'Olá! Sou a Gê, da GeniAI. Seus dados ficam só neste atendimento. Qual o seu nome e o nome da sua empresa?',
      0.2,
    ],
  ]
  if (etapa === 'perdido') {
    falas.push(['cliente', `Sou ${nome}, queria saber se vocês estão contratando desenvolvedor`, 2])
    falas.push([
      'bot',
      'Obrigada pelo interesse! Aqui eu atendo empresas que querem conhecer as soluções da GeniAI. As vagas saem no nosso site.',
      2.2,
    ])
  } else if (passou('triagem')) {
    const tamanho = dizPorte ? `somos ${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'}` : 'empresa pequena ainda'
    falas.push(['cliente', `${nome}, da ${empresa}, aqui em ${cidade}. ${maiuscula(tamanho)}.`, 3])
    falas.push(['bot', `Prazer, ${nome}! O que você gostaria de resolver na ${empresa}?`, 3.2])
  }
  if (passou('apresentacao')) {
    falas.push(['cliente', `Queria ${n.dor}`, 6])
    falas.push([
      'bot',
      n.produto === 'audiobot'
        ? `Entendi. O *Audiobot* grava ${n.ambiente} e gera relatórios do que acontece. Por quantas horas por dia você quer acompanhar?`
        : 'Entendi. O *Disparador* manda mensagens em massa pela API oficial do WhatsApp. Quantos contatos vocês têm na base?',
      6.2,
    ])
  }
  if (passou('interesse')) {
    falas.push([
      'cliente',
      n.produto === 'audiobot'
        ? `Umas ${plano.horas} horas. Quanto custa?`
        : `Uns ${base.toLocaleString('pt-BR')} contatos. Qual o valor?`,
      9,
    ])
    falas.push([
      'bot',
      n.produto === 'audiobot'
        ? `Para ${plano.horas} horas por dia, o plano ${plano.nome} sai por *${plano.preco}*. Quer falar com um especialista para ver a instalação?`
        : 'O Disparador tem *R$ 999* de implementação e R$ 499 de mensalidade. Quer falar com um especialista para ver o seu caso?',
      9.2,
    ])
  }
  if (encaminhado) {
    falas.push(['cliente', 'Quero sim', 12])
    falas.push(['bot', 'Ótimo! Para quando pensa em começar? E é você quem decide essa contratação?', 12.2])
    falas.push([
      'cliente',
      `${maiuscula(urgenciaFala)}. ${decisor ? 'Sou eu que decido.' : 'Preciso ver com meu sócio.'}`,
      15,
    ])
    falas.push([
      'bot',
      'Obrigada! Vou passar sua conversa para um especialista da GeniAI, que responde das 8h às 17h.',
      15.2,
    ])
    if (status !== 'a_contatar') {
      falas.push([
        'humano',
        `Oi, ${nome}! Aqui é o Pedro, especialista da GeniAI. Vi sua conversa com a Gê, posso te ligar hoje?`,
        120,
      ])
      falas.push(['cliente', 'Pode sim, depois das 14h', 135])
    }
    if (status === 'fechado') falas.push(['humano', 'Contrato enviado, qualquer dúvida me chama por aqui!', 1500])
  }
  if (etapa === 'interesse' && i % 2 === 0) {
    // Voltou dias depois: aparece o divisor de sessão na conversa.
    falas.push(['cliente', 'Oi, voltei. Ainda estou pensando no valor', 3000])
    falas.push([
      'bot',
      'Oi de novo! Sem problema. Se quiser, um especialista tira as dúvidas sobre o investimento. Posso chamar?',
      3000.2,
    ])
  }

  const lead = {
    nome: passou('triagem') || etapa === 'perdido' ? nome : null,
    empresa: passou('triagem') ? empresa : null,
    cidade: passou('triagem') ? cidade : null,
    porte: passou('triagem') && dizPorte ? porte : null,
    colaboradores: passou('triagem') && dizPorte ? pessoas : null,
    dor: passou('apresentacao') ? n.dor : null,
    servicos: passou('interesse') ? [n.produto] : [],
    plano: passou('interesse') && n.produto === 'audiobot' ? plano.chave : null,
    base_clientes: passou('interesse') && n.produto === 'disparador' ? base : null,
    urgencia: encaminhado ? urgencia : null,
    decisor,
    telefone: i === 7 ? '(83) 98877-6655' : null,
    pediu_contato: encaminhado,
    fora_do_perfil: etapa === 'perdido' ? true : null,
    resumo:
      etapa === 'perdido'
        ? `${nome} procurava vaga de emprego; não é cliente.`
        : passou('triagem')
          ? [
              `${nome}, da ${empresa} (${cidade}), quer ${n.dor}.`,
              passou('interesse')
                ? n.produto === 'audiobot'
                  ? `Indicado o Audiobot plano ${plano.nome} (${plano.preco}, ${plano.horas}h por dia).`
                  : `Indicado o Disparador para uma base de ${base.toLocaleString('pt-BR')} contatos (R$ 999 + R$ 499/mês).`
                : `Ainda conhecendo o ${produto}.`,
              encaminhado
                ? `Pediu especialista; ${urgenciaFala}${decisor ? ', decide sozinho' : ', depende do sócio'}.`
                : '',
            ]
              .filter(Boolean)
              .join(' ')
          : null,
  }

  // Mesmas regras do cérebro (cerebro/agente/lead.py), para a pontuação bater com o que a Gê calcularia.
  let score = 0
  if (!lead.fora_do_perfil) {
    const gente = lead.colaboradores
    score += lead.porte ? PONTOS_PORTE[lead.porte] : gente == null ? 0 : gente < 10 ? 10 : 15
    if (gente != null) score += gente >= 10 ? 10 : 5
    if (lead.dor) score += 15
    if (lead.servicos.length) score += 15
    if (lead.plano || (lead.base_clientes ?? 0) >= 500) score += 15
    score += lead.urgencia === 'imediata' ? 15 : lead.urgencia === 'ate_3_meses' ? 10 : 0
    if (lead.decisor) score += 10
    if (lead.pediu_contato) score = Math.max(score, 70)
  }
  return { etapa, status, lead, score, temperatura: score >= 70 ? 'quente' : score >= 40 ? 'morno' : 'frio', falas }
}

const agora = Date.now()
const HORA = 3_600_000
const db = await pool.connect()
// Numa transação só: se falhar no meio, o banco demo fica como estava, não pela metade.
await db.query('begin')
await db.query('truncate mensagens, contatos')
for (let i = 0; i < NOMES.length; i++) {
  const { etapa, status, lead, score, temperatura, falas } = montar(i)
  // Mais leads nos dias recentes: a curva de "novos leads" mostra a divulgação ganhando tração.
  const diasAtras = Math.floor(13 * (1 - Math.sqrt(((i * 29) % NOMES.length) / NOMES.length)))
  const inicio = agora - diasAtras * 24 * HORA - ((i * 7) % 9) * HORA - 30 * 60_000
  const em = (min: number) => new Date(Math.min(inicio + min * 60_000, agora - 60_000))
  const fim = em(falas.at(-1)?.[2] ?? 0)
  // Um contato só com @lid: o telefone vem do que o cliente digitou, e o link do WhatsApp precisa do 55.
  const id = i === 7 ? `demo-${i}@lid` : `55839${String(91000000 + i * 1379).padStart(8, '0')}`
  const encerrada = etapa === 'encaminhado' || etapa === 'perdido' ? fim : null
  await db.query(
    `insert into contatos (id, phone, nome_whatsapp, lead, score, temperatura, etapa, status_comercial,
       criado_em, atualizado_em, sessao_inicio, encerrada_em)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, $11)`,
    [id, id, NOMES[i], lead, score, temperatura, etapa, status, new Date(inicio), fim, encerrada],
  )
  for (const [j, [autor, texto, min]] of falas.entries()) {
    await db.query(
      'insert into mensagens (id, contato_id, autor, texto, respondida, criado_em) values ($1, $2, $3, $4, true, $5)',
      [`${id}-${j}`, id, autor, texto, em(min)],
    )
  }
}
await db.query('commit')
db.release()
await pool.end()
console.log(`${NOMES.length} leads fictícios no geniai_demo`)
