import { ETAPAS } from './tipos.ts'

// As chaves do banco e do cérebro ficam como estão; a tela só troca o nome.
export const PRIORIDADE: Record<string, string> = { quente: 'Alta', morno: 'Média', frio: 'Baixa' }
export const ETAPA: Record<string, string> = {
  novo: 'Primeiro contato',
  triagem: 'Identificado',
  apresentacao: 'Necessidade mapeada',
  interesse: 'Produto apresentado',
  encaminhado: 'Com especialista',
  perdido: 'Fora do perfil',
}
export const STATUS: Record<string, string> = {
  a_contatar: 'A contatar',
  contatado: 'Em contato',
  reuniao: 'Reunião agendada',
  fechado: 'Venda fechada',
  perdido: 'Perdido',
}
export const PORTE: Record<string, string> = {
  MEI: 'MEI',
  ME: 'Microempresa',
  EPP: 'Pequena empresa',
  media: 'Média empresa',
  grande: 'Grande empresa',
}
export const URGENCIA: Record<string, string> = {
  imediata: 'Imediato',
  ate_3_meses: 'Até 3 meses',
  sem_pressa: 'Sem pressa',
}
export const PRODUTO: Record<string, string> = { audiobot: 'Audiobot', disparador: 'Disparador' }
export const PLANO: Record<string, string> = { inicial: 'Inicial', padrao: 'Padrão', premium: 'Premium' }

export function haQuanto(data: string | Date, agora = Date.now()): string {
  const min = Math.round((agora - new Date(data).getTime()) / 60_000)
  if (min < 60) return `há ${Math.max(1, min)} min`
  if (min < 24 * 60) return `há ${Math.round(min / 60)} h`
  return `há ${Math.round(min / (24 * 60))} d`
}

export type Degrau = { rotulo: string; n: number; conversao: number | null }

// Etapa guarda o ponto mais longe a que o lead chegou, então quem está adiante também passou pelas anteriores.
export function funil(porEtapa: Record<string, number>): { degraus: Degrau[]; foraDoPerfil: number } {
  const escada = ETAPAS.filter((e) => e !== 'perdido')
  let acumulado = 0
  const n: number[] = Array(escada.length).fill(0)
  for (let i = escada.length - 1; i >= 0; i--) {
    acumulado += porEtapa[escada[i]] ?? 0
    n[i] = acumulado
  }
  const degraus = escada.map((e, i) => ({
    rotulo: ETAPA[e],
    n: n[i],
    conversao: i === 0 ? null : n[i - 1] ? Math.round((n[i] / n[i - 1]) * 100) : 0,
  }))
  return { degraus, foraDoPerfil: porEtapa.perdido ?? 0 }
}
