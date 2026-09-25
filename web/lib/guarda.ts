import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { sql, sqlDemo } from './db.ts'
import { COOKIE_SESSAO, validarToken } from './sessao.ts'

// Server action é chamada pelo id, de qualquer rota, inclusive /login: toda action que grava começa por aqui.
export async function exigirSessao(): Promise<string> {
  const usuario = await validarToken((await cookies()).get(COOKIE_SESSAO)?.value)
  if (!usuario) redirect('/login')
  return usuario
}

// O usuário de apresentação tem senha fácil: ele só pode enxergar o banco fictício, nunca os leads reais.
export async function bancoDoPainel() {
  const usuario = await exigirSessao()
  return process.env.DEMO_USER && usuario === process.env.DEMO_USER ? sqlDemo() : sql()
}
