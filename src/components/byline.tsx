import { ClockIcon } from '@/components/ui/icon'
import { formatDate } from '@/lib/date'
import { site } from '@/site'

type BylineProps = { date: string; minutes?: number; compact?: boolean }

/** Author, date and read time - the same row on the article and on cards. */
export const Byline = ({ date, minutes, compact = false }: BylineProps) => (
  <div
    className={
      compact
        ? 'flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--text-muted)]'
        : 'flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px] text-[var(--text-muted)]'
    }
  >
    {!compact && (
      <img
        src={site.author.avatar}
        alt=""
        width={40}
        height={40}
        className="size-10 rounded-full object-cover"
      />
    )}
    <span className="font-medium text-[var(--text)]">{compact ? site.author.name : `By ${site.author.name}`}</span>
    {date && (
      <>
        <span aria-hidden className="text-[var(--border)]">·</span>
        <time dateTime={date}>{formatDate(date)}</time>
      </>
    )}
    {minutes !== undefined && (
      <>
        <span aria-hidden className="text-[var(--border)]">·</span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <ClockIcon className="size-3.5" />
          {minutes} min read
        </span>
      </>
    )}
  </div>
)
