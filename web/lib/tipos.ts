export const ETAPAS = ['novo', 'triagem', 'apresentacao', 'interesse', 'encaminhado', 'perdido'] as const
export const STATUS_COMERCIAL = ['a_contatar', 'contatado', 'reuniao', 'fechado', 'perdido'] as const

export type Etapa = (typeof ETAPAS)[number]
export type Temperatura = 'quente' | 'morno' | 'frio'
export type Turno = { autor: 'cliente' | 'bot' | 'humano'; texto: string }
export type Audio = { url: string; segundos: number }

export const AUDIO_SEM_TEXTO = '[áudio]'
export const PREFIXO_AUDIO = '[áudio] '
// Marca o áudio enquanto a OpenAI transcreve: quem for responder espera ele virar texto.
export const TRANSCREVENDO = '[áudio em transcrição]'
export const falaDoAudio = (texto: string) =>
  texto.startsWith(PREFIXO_AUDIO) ? texto.slice(PREFIXO_AUDIO.length) : null
// O cérebro (Python) é dono do formato do lead; aqui ele só é guardado e exibido.
export type Lead = Record<string, unknown>
