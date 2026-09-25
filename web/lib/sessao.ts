import { createHash, timingSafeEqual } from 'node:crypto'
import { jwtVerify, SignJWT } from 'jose'

export const COOKIE_SESSAO = 'sessao'
export const DURACAO_SESSAO_S = 7 * 24 * 60 * 60

const chave = () => new TextEncoder().encode(process.env.AUTH_SECRET)

export function criarToken(usuario: string): Promise<string> {
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET não configurado')
  return new SignJWT()
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(usuario)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_S}s`)
    .sign(chave())
}

export async function validarToken(token: string | undefined): Promise<boolean> {
  if (!token || !process.env.AUTH_SECRET) return false
  try {
    // Algoritmo fixo: o token não escolhe como vai ser verificado.
    await jwtVerify(token, chave(), { algorithms: ['HS256'] })
    return true
  } catch {
    return false
  }
}

const hash = (s: string) => createHash('sha256').update(s).digest()

// Tempo constante sobre os hashes (mesmo tamanho): o tempo de resposta não revela quanto do segredo acertou.
export const mesmoValor = (a: string, b: string) => timingSafeEqual(hash(a), hash(b))

export function credenciaisValidas(usuario: string, senha: string): boolean {
  const { DASHBOARD_USER, DASHBOARD_PASSWORD } = process.env
  if (!DASHBOARD_USER || !DASHBOARD_PASSWORD) return false
  const usuarioOk = mesmoValor(usuario, DASHBOARD_USER)
  const senhaOk = mesmoValor(senha, DASHBOARD_PASSWORD)
  return usuarioOk && senhaOk
}

const ORIGEM = 'http://painel.invalido'

// Interpreta como o navegador interpreta: "//site", "/\\site" e "/<tab>/site" viram outro domínio.
export function destinoSeguro(de: unknown): string {
  if (typeof de !== 'string' || !de.startsWith('/')) return '/'
  const url = new URL(de, ORIGEM)
  return url.origin === ORIGEM ? url.pathname + url.search : '/'
}
