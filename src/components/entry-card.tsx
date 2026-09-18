import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardMeta, CardTitle } from '@/components/ui/card'
import type { ContentEntry } from '@/lib/types'

export const EntryCard = ({ entry }: { entry: ContentEntry }) => (
  <Link
    to={`/${entry.kind === 'doc' ? 'docs' : 'blog'}/${entry.slug}`}
    className="block cursor-pointer no-underline"
  >
    <Card className="h-full transition-colors hover:border-[var(--primary)]">
      <CardTitle>{entry.meta.title}</CardTitle>
      <CardMeta className="mt-1.5">{entry.meta.summary}</CardMeta>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {entry.quiz.length > 0 && <Badge tone="primary">{entry.quiz.length}-question quiz</Badge>}
        {entry.meta.minutes && <Badge>{entry.meta.minutes} min</Badge>}
        {entry.meta.tags.slice(0, 3).map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>
    </Card>
  </Link>
)
