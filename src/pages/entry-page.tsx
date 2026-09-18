import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Article } from '@/components/article'
import { MobileToc } from '@/components/mobile-toc'
import { Quiz } from '@/components/quiz'
import { SeriesNav } from '@/components/series-nav'
import { TocSidebar } from '@/components/toc-sidebar'
import { useActiveHeading } from '@/components/use-active-heading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon } from '@/components/ui/icon'
import { findEntry } from '@/lib/content'
import { renderMarkdown } from '@/lib/markdown'
import type { ContentKind } from '@/lib/types'

type EntryPageProps = { kind: ContentKind; bionic: boolean }

export const EntryPage = ({ kind, bionic }: EntryPageProps) => {
  const { slug = '' } = useParams()
  const entry = findEntry(kind, slug)
  const rendered = useMemo(() => (entry ? renderMarkdown(entry.body) : null), [entry])
  const active = useActiveHeading(rendered?.headings ?? [])

  if (!entry || !rendered) {
    return (
      <div className="py-20 text-center">
        <p className="text-[var(--text-muted)]">That page does not exist.</p>
        <Link to="/">
          <Button className="mt-4" icon={<ArrowLeftIcon />}>
            Back home
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex gap-10">
      <div className="min-w-0 flex-1">
        <MobileToc headings={rendered.headings} active={active} />

        <header className="mb-8">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {entry.meta.date && <Badge>{entry.meta.date}</Badge>}
            {entry.meta.minutes && <Badge>{entry.meta.minutes} min</Badge>}
            {entry.meta.tags.map((tag) => (
              <Badge key={tag} tone="primary">
                {tag}
              </Badge>
            ))}
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">
            {entry.meta.title}
          </h1>
          {entry.meta.summary && (
            <p className="mt-2 max-w-[62ch] text-[17px] text-[var(--text-muted)]">{entry.meta.summary}</p>
          )}
        </header>

        <Article html={rendered.html} bionic={bionic} />

        <Quiz title={entry.meta.title} items={entry.quiz} bionic={bionic} />

        {kind === 'doc' && <SeriesNav slug={entry.slug} />}
      </div>

      <TocSidebar headings={rendered.headings} active={active} />
    </div>
  )
}
