// O Neon hiberna: o primeiro clique pode levar um segundo, e sem isto o painel parece travado.
export default function Carregando() {
  const bloco = 'rounded-2xl bg-superficie motion-safe:animate-pulse'
  return (
    <output className="block space-y-8" aria-label="Carregando">
      <div className="space-y-3">
        <div className="h-3 w-32 rounded bg-superficie" />
        <div className="h-10 w-56 rounded-lg bg-superficie motion-safe:animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {['a', 'b', 'c', 'd', 'e'].map((k) => (
          <div key={k} className={`h-28 ${bloco}`} />
        ))}
      </div>
      <div className={`h-72 ${bloco}`} />
    </output>
  )
}
