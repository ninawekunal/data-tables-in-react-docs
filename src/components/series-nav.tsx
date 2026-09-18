import { Link } from 'react-router-dom'
import { Card, CardMeta } from '@/components/ui/card'
import { docs } from '@/lib/content'

/** Previous / next links between parts of the same series. */
export const SeriesNav = ({ slug }: { slug: string }) => {
  const current = docs.find((d) => d.slug === slug)

  if (!current?.meta.series) return null

  const parts = docs
    .filter((d) => d.meta.series === current.meta.series)
    .sort((a, b) => (a.meta.part ?? 0) - (b.meta.part ?? 0))
  const index = parts.indexOf(current)

  const prev = parts[index - 1]
  const next = parts[index + 1]

  return (
    <nav aria-label="Series" className="mt-10 grid gap-3 sm:grid-cols-2">
      {prev ? (
        <Link to={`/docs/${prev.slug}`} className="block cursor-pointer">
          <Card className="h-full p-4 transition-colors hover:border-[var(--primary)]">
            <CardMeta>Previous - part {prev.meta.part}</CardMeta>
            <p className="m-0 mt-1 text-sm font-semibold">{prev.meta.title}</p>
          </Card>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link to={`/docs/${next.slug}`} className="block cursor-pointer sm:text-right">
          <Card className="h-full p-4 transition-colors hover:border-[var(--primary)]">
            <CardMeta>Next - part {next.meta.part}</CardMeta>
            <p className="m-0 mt-1 text-sm font-semibold">{next.meta.title}</p>
          </Card>
        </Link>
      )}
    </nav>
  )
}
