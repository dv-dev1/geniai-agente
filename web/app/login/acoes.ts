'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE_SESSAO, credenciaisValidas, criarToken, DURACAO_SESSAO_S, destinoSeguro } from '@/lib/sessao.ts'

export type Tentativa = { erro: string; usuario: string } | null

export async function entrar(_: Tentativa, form: FormData): Promise<Tentativa> {
  const usuario = String(form.get('usuario') ?? '')
  if (!credenciaisValidas(usuario, String(form.get('senha') ?? '')))
    return { erro: 'Usuário ou senha incorretos.', usuario }
  ;(await cookies()).set(COOKIE_SESSAO, await criarToken(usuario), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_SESSAO_S,
  })
  redirect(destinoSeguro(form.get('de')))
}

export async function sair(): Promise<void> {
  ;(await cookies()).delete(COOKIE_SESSAO)
  redirect('/login')
}
