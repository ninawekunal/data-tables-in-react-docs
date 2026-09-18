import { useEffect, useRef, useState } from 'react'
import { ChevronIcon, ListIcon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import type { Heading } from '@/lib/types'

type MobileTocProps = { headings: Heading[]; active: string }

/**
 * The mobile navigation model: one sticky bar under the header showing the
 * section you are in, which expands into the full section list on tap.
 */
export const MobileToc = ({ headings, active }: MobileTocProps) => {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const current = headings.find((h) => h.id === active) ?? headings[0]

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onClick)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onClick)
    }
  }, [open])

  if (headings.length === 0) return null

  return (
    <div
      ref={wrapRef}
      className="sticky top-[57px] z-30 -mx-4 mb-5 border-b border-[var(--border)] bg-[var(--bg)]/95 px-4 backdrop-blur lg:hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="mobile-toc-panel"
        className="flex h-12 w-full cursor-pointer items-center gap-2 text-left text-[13px] text-[var(--text)]"
      >
        <ListIcon className="shrink-0 text-[var(--primary)]" />
        <span className="min-w-0 flex-1 truncate font-medium">{current?.text ?? 'Sections'}</span>
        <ChevronIcon className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          id="mobile-toc-panel"
          className="absolute inset-x-0 top-full max-h-[60vh] overflow-y-auto border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 shadow-[var(--shadow)]"
        >
          <ul>
            {headings.map((heading) => (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'block cursor-pointer rounded-lg px-2 py-2.5 text-[13px] leading-snug',
                    heading.level === 3 && 'pl-6 text-[var(--text-muted)]',
                    active === heading.id
                      ? 'bg-[var(--primary-soft)] font-medium text-[var(--primary)]'
                      : 'text-[var(--text)]',
                  )}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
