import { cn } from '@/lib/cn'
import { scrollToSection } from '@/lib/scroll-to'
import type { Heading } from '@/lib/types'

type TocSidebarProps = { headings: Heading[]; active: string }

export const TocSidebar = ({ headings, active }: TocSidebarProps) => {
  if (headings.length === 0) return null

  return (
    <nav
      aria-label="On this page"
      className="sticky top-24 hidden max-h-[calc(100vh-8rem)] w-60 shrink-0 overflow-y-auto lg:block"
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        On this page
      </p>
      <ul className="space-y-0.5 border-l border-[var(--border)]">
        {headings.map((heading, index) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={(event) => scrollToSection(event, heading.id)}
              className={cn(
                '-ml-px block cursor-pointer border-l-2 py-1 text-[13px] leading-snug transition-colors',
                heading.level === 3 ? 'pl-6' : 'pl-3',
                active === heading.id
                  ? 'border-[var(--primary)] font-medium text-[var(--primary)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]',
              )}
            >
              {heading.level === 2 && (
                <span className="mr-1.5 tabular-nums opacity-60">
                  {String(headings.filter((h, i) => h.level === 2 && i <= index).length).padStart(2, '0')}
                </span>
              )}
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
