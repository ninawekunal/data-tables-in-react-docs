import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'primary' | 'accent' }

const TONES = {
  neutral: 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]',
  primary: 'bg-[var(--primary-soft)] text-[var(--primary)] border-transparent',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent',
} as const

export const Badge = ({ tone = 'neutral', className, ...rest }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide',
      TONES[tone],
      className,
    )}
    {...rest}
  />
)
