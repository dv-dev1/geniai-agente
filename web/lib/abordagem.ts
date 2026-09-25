import { PLANO, PRODUTO } from './rotulos.ts'
import type { Lead } from './tipos.ts'

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

// Telefone digitado pelo cliente (contato @lid) costuma vir sem o 55; o wa.me só abre com o número internacional.
function internacional(telefone: string): string {
  const d = telefone.replace(/\D/g, '')
  return d.length === 10 || d.length === 11 ? `55${d}` : d
}

export function linkWhatsApp(telefone: string, texto: string): string {
  return `https://wa.me/${internacional(telefone)}?text=${encodeURIComponent(texto)}`
}

export function formatarTelefone(telefone: string): string {
  const m = internacional(telefone).match(/^55(\d{2})(\d{4,5})(\d{4})$/)
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : telefone
}

export function trechos(texto: string): [trecho: string, negrito: boolean][] {
  return texto
    .split(/\*([^*\s][^*\n]*?)\*/)
    .map((t, i): [string, boolean] => [t, i % 2 === 1])
    .filter(([t]) => t)
}
