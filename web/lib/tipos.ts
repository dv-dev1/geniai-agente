export const ETAPAS = ['novo', 'triagem', 'apresentacao', 'interesse', 'encaminhado', 'perdido'] as const
export const STATUS_COMERCIAL = ['a_contatar', 'contatado', 'reuniao', 'fechado', 'perdido'] as const

export type Etapa = (typeof ETAPAS)[number]
export type Temperatura = 'quente' | 'morno' | 'frio'
export type Turno = { autor: 'cliente' | 'bot' | 'humano'; texto: string }
// O cérebro (Python) é dono do formato do lead; aqui ele só é guardado e exibido.
export type Lead = Record<string, unknown>
