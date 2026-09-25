'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const SEGUNDOS = 5

// Polling, não websocket: a Vercel é serverless, e 5 s bastam para a conversa aparecer enquanto acontece.
export function AoVivo() {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, SEGUNDOS * 1000)
    return () => clearInterval(id)
  }, [router])
  return (
    <span
      className="hidden items-center gap-1.5 text-xs text-suave sm:flex"
      title={`O painel se atualiza sozinho a cada ${SEGUNDOS} s`}
    >
      <span className="size-1.5 rounded-full bg-ciano motion-safe:animate-pulse" />
      ao vivo
    </span>
  )
}
