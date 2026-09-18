import { useMemo, useState } from 'react'
import { EntryCard } from '@/components/entry-card'
import { Button } from '@/components/ui/button'
import { allTags } from '@/lib/content'
import type { ContentEntry } from '@/lib/types'

type ListPageProps = { title: string; blurb: string; entries: ContentEntry[] }

export const ListPage = ({ title, blurb, entries }: ListPageProps) => {
  const [tag, setTag] = useState<string | null>(null)
  const tags = useMemo(() => allTags(entries), [entries])
  const shown = tag ? entries.filter((e) => e.meta.tags.includes(tag)) : entries

  return (
    <div>
      <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 max-w-[62ch] text-[var(--text-muted)]">{blurb}</p>

      {tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" active={tag === null} onClick={() => setTag(null)}>
            All
          </Button>
          {tags.map((t) => (
            <Button key={t} size="sm" variant="ghost" active={tag === t} onClick={() => setTag(t)}>
              {t}
            </Button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="mt-10 text-[var(--text-muted)]">Nothing here yet.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {shown.map((entry) => (
            <EntryCard key={entry.slug} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
