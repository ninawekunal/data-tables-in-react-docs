import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const Card = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]',
      className,
    )}
    {...rest}
  />
)

export const CardTitle = ({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-base font-semibold tracking-tight', className)} {...rest} />
)

export const CardMeta = ({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-[13px] text-[var(--text-muted)]', className)} {...rest} />
)
