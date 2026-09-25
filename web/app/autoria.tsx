import { Fragment } from 'react'

const LINKS = [
  ['GitHub', 'https://github.com/dv-dev1'],
  ['LinkedIn', 'https://www.linkedin.com/in/dv-dev/'],
] as const

export function Autoria({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-suave ${className}`}>
      Desenvolvido por <span className="text-white/80">dv-dev1</span>
      {LINKS.map(([rotulo, href]) => (
        <Fragment key={rotulo}>
          {' · '}
          <a
            href={href}
            target="_blank"
            rel="noopener"
            className="underline-offset-4 transition-colors duration-150 hover:text-white hover:underline"
          >
            {rotulo}
          </a>
        </Fragment>
      ))}
    </p>
  )
}
