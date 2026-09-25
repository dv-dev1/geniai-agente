import { type NextRequest, NextResponse } from 'next/server'
import { COOKIE_SESSAO, validarToken } from './lib/sessao.ts'

export async function proxy(req: NextRequest) {
  const logado = await validarToken(req.cookies.get(COOKIE_SESSAO)?.value)
  const naTelaDeLogin = req.nextUrl.pathname === '/login'
  if (logado && naTelaDeLogin) return NextResponse.redirect(new URL('/', req.url))
  if (logado || naTelaDeLogin) return NextResponse.next()
  const login = new URL('/login', req.url)
  login.searchParams.set('de', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(login)
}

export const config = { matcher: ['/((?!api/webhook|_next/static|_next/image|favicon.ico|geniai-icone.png).*)'] }
