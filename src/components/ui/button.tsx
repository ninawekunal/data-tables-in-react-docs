import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline'
type Size = 'sm' | 'md'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  active?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[var(--primary)] text-[var(--bg)] hover:opacity-90',
  secondary: 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)]',
  ghost: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
  outline: 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-2)]',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
}

export const Button = ({
  variant = 'secondary',
  size = 'md',
  icon,
  active = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    className={cn(
      'inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition-colors',
      'disabled:cursor-not-allowed disabled:opacity-50',
      VARIANTS[variant],
      SIZES[size],
      active && 'ring-1 ring-[var(--primary)] text-[var(--primary)]',
      className,
    )}
    aria-pressed={rest['aria-pressed'] ?? (active ? true : undefined)}
    {...rest}
  >
    {icon}
    {children}
  </button>
)
