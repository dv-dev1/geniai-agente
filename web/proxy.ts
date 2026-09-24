import { type NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const { DASHBOARD_USER, DASHBOARD_PASSWORD } = process.env
  // Sem senha configurada, fecha: o dashboard tem dado pessoal (LGPD).
  if (
    DASHBOARD_PASSWORD &&
    req.headers.get('authorization') === `Basic ${btoa(`${DASHBOARD_USER}:${DASHBOARD_PASSWORD}`)}`
  ) {
    return NextResponse.next()
  }
  return new NextResponse('Acesso restrito', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="GeniAI"' } })
}

export const config = { matcher: ['/((?!api/webhook|_next/static|_next/image|favicon.ico|geniai-icone.png).*)'] }
