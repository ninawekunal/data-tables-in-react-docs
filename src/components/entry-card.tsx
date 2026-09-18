import { Link } from 'react-router-dom'
import { Byline } from '@/components/byline'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { ContentEntry } from '@/lib/types'

export const EntryCard = ({ entry }: { entry: ContentEntry }) => (
  <Link
    to={`/${entry.kind === 'doc' ? 'docs' : 'blog'}/${entry.slug}`}
    className="group block cursor-pointer no-underline"
  >
    <Card className="flex h-full flex-col transition-colors group-hover:border-[var(--primary)]">
      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
        {entry.meta.part !== undefined ? `Part ${entry.meta.part}` : (entry.meta.tags[0] ?? entry.kind)}
      </p>
      <h3 className="font-display mt-2 text-[19px] font-bold leading-snug tracking-tight">{entry.meta.title}</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--text-muted)]">{entry.meta.summary}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <Byline date={entry.meta.date} minutes={entry.meta.minutes} compact />
        {entry.quiz.length > 0 && <Badge tone="primary">{entry.quiz.length}-question quiz</Badge>}
      </div>
    </Card>
  </Link>
)
