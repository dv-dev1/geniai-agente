import type { Lead } from './tipos.ts'

const PRODUTO: Record<string, string> = { audiobot: 'Audiobot', disparador: 'Disparador' }
const PLANO: Record<string, string> = { inicial: 'Inicial', padrao: 'Padrão', premium: 'Premium' }

export function mensagemDoEspecialista(lead: Lead, nomeWhatsapp: string | null): string {
  const nome = (lead.nome as string | null) ?? nomeWhatsapp
  const produtos = ((lead.servicos as string[] | undefined) ?? []).map((s) => PRODUTO[s] ?? s).join(' e ')
  const plano = PLANO[lead.plano as string]
  let contexto = 'Vi que você conversou com a Gê'
  if (produtos) contexto += ` sobre o ${produtos}${plano ? ` (plano ${plano})` : ''}`
  if (lead.empresa) contexto += ` para a ${lead.empresa}`
  if (lead.dor) contexto += `, com foco em ${lead.dor}`
  return `Olá${nome ? `, ${nome}` : ''}! Sou especialista da GeniAI. ${contexto}. Podemos seguir por aqui?`
}

export function linkWhatsApp(telefone: string, texto: string): string {
  return `https://wa.me/${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
}
