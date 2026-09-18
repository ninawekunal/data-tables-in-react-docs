import { useMemo } from 'react'
import raw from '/content/how-it-works.md?raw'
import { Article } from '@/components/article'
import { MobileToc } from '@/components/mobile-toc'
import { TocSidebar } from '@/components/toc-sidebar'
import { useActiveHeading } from '@/components/use-active-heading'
import { parseFrontmatter } from '@/lib/frontmatter'
import { renderMarkdown } from '@/lib/markdown'

export const HowItWorks = ({ bionic }: { bionic: boolean }) => {
  const { meta, rendered } = useMemo(() => {
    const parsed = parseFrontmatter(raw)

    return { meta: parsed.meta, rendered: renderMarkdown(parsed.body) }
  }, [])
  const active = useActiveHeading(rendered.headings)

  return (
    <div className="flex gap-10">
      <div className="min-w-0 flex-1">
        <MobileToc headings={rendered.headings} active={active} />
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">
          {meta.title}
        </h1>
        <p className="mb-8 mt-2 max-w-[62ch] text-[17px] text-[var(--text-muted)]">{meta.summary}</p>
        <Article html={rendered.html} bionic={bionic} />
      </div>
      <TocSidebar headings={rendered.headings} active={active} />
    </div>
  )
}
