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

export function credenciaisValidas(usuario: string, senha: string): boolean {
  const { DASHBOARD_USER, DASHBOARD_PASSWORD } = process.env
  if (!DASHBOARD_USER || !DASHBOARD_PASSWORD) return false
  // Compara os hashes (mesmo tamanho) e sempre os dois: o tempo de resposta não revela qual campo errou.
  const usuarioOk = timingSafeEqual(hash(usuario), hash(DASHBOARD_USER))
  const senhaOk = timingSafeEqual(hash(senha), hash(DASHBOARD_PASSWORD))
  return usuarioOk && senhaOk
}

// "//site" e "/\site" o navegador trata como outro domínio: aceitar viraria redirecionamento aberto.
export function destinoSeguro(de: unknown): string {
  return typeof de === 'string' && de.startsWith('/') && !de.startsWith('//') && !de.startsWith('/\\') ? de : '/'
}
