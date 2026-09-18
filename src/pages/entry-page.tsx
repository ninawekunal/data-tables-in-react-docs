import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Article } from '@/components/article'
import { MobileToc } from '@/components/mobile-toc'
import { Quiz } from '@/components/quiz'
import { SeriesNav } from '@/components/series-nav'
import { TocSidebar } from '@/components/toc-sidebar'
import { useActiveHeading } from '@/components/use-active-heading'
import { Byline } from '@/components/byline'
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

        <header className="mb-10 border-b border-[var(--border)] pb-8">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
            {entry.meta.part !== undefined
              ? `${entry.meta.series ? `${entry.meta.series} · ` : ''}Part ${entry.meta.part}`
              : (entry.meta.tags[0] ?? entry.kind)}
          </p>
          <h1 className="font-display text-[28px] font-bold leading-[1.15] tracking-[-0.015em] sm:text-[40px]">
            {entry.meta.title}
          </h1>
          {entry.meta.summary && (
            <p className="mt-3 max-w-[62ch] text-[17px] leading-snug text-[var(--text-muted)] sm:text-[20px]">
              {entry.meta.summary}
            </p>
          )}
          <div className="mt-6">
            <Byline date={entry.meta.date} minutes={entry.meta.minutes} />
          </div>
        </header>

        <Article html={rendered.html} bionic={bionic} />

        {entry.meta.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-1.5">
            {entry.meta.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        )}

        <Quiz title={entry.meta.title} items={entry.quiz} bionic={bionic} />

        {kind === 'doc' && <SeriesNav slug={entry.slug} />}
      </div>

      <TocSidebar headings={rendered.headings} active={active} />
    </div>
  )
}
