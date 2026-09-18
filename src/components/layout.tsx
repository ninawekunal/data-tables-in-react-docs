import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ReaderControls } from '@/components/reader-controls'
import { cn } from '@/lib/cn'
import { site } from '@/site'

type LayoutProps = {
  children: ReactNode
  bionic: boolean
  onToggleBionic: () => void
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'cursor-pointer whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors sm:px-2.5',
    isActive ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]',
  )

export const Layout = ({ children, bionic, onToggleBionic }: LayoutProps) => (
  <div className="min-h-dvh">
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-3 sm:gap-2 sm:px-4">
        <Link
          to="/"
          className="mr-0.5 cursor-pointer whitespace-nowrap text-[14px] font-semibold tracking-tight text-[var(--text)] sm:mr-1 sm:text-[15px]"
        >
          {site.name}
          <span className="text-[var(--primary)]">{site.nameAccent}</span>
        </Link>
        <nav className="flex items-center gap-0.5">
          <NavLink to="/docs" className={navClass}>
            Docs
          </NavLink>
          {site.showBlog && (
            <NavLink to="/blog" className={navClass}>
              Blog
            </NavLink>
          )}
          <NavLink to="/how-it-works" className={navClass}>
            {site.aboutLabel}
          </NavLink>
        </nav>
        <div className="ml-auto shrink-0">
          <ReaderControls bionic={bionic} onToggleBionic={onToggleBionic} />
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-4 pb-24 pt-8">{children}</main>

    <footer className="border-t border-[var(--border)] py-8 text-center text-[13px] text-[var(--text-muted)]">
      {site.footer} Built with the{' '}
      <a
        className="cursor-pointer text-[var(--primary)]"
        href="https://github.com/ninawekunal/learning-doc-builder"
      >
        learning-doc-builder
      </a>{' '}
      skill. MIT licensed.
    </footer>
  </div>
)
