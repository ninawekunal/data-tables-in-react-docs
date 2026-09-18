import { ClockIcon } from '@/components/ui/icon'
import { formatDate } from '@/lib/date'
import { site } from '@/site'

type BylineProps = { date: string; minutes?: number; compact?: boolean }

const Meta = ({ date, minutes }: { date: string; minutes?: number }) => (
  <span className="inline-flex flex-wrap items-center gap-x-2">
    {date && <time dateTime={date}>{formatDate(date)}</time>}
    {date && minutes !== undefined && <span aria-hidden>·</span>}
    {minutes !== undefined && (
      <span className="inline-flex items-center gap-1 tabular-nums">
        <ClockIcon className="size-3.5" />
        {minutes} min read
      </span>
    )}
  </span>
)

/** Author, date and read time: avatar plus two lines on articles, one line on cards. */
export const Byline = ({ date, minutes, compact = false }: BylineProps) =>
  compact ? (
    <span className="inline-flex flex-wrap items-center gap-x-2 text-[13px] text-[var(--text-muted)]">
      <span className="font-medium text-[var(--text)]">{site.author.name}</span>
      <span aria-hidden>·</span>
      <Meta date={date} minutes={minutes} />
    </span>
  ) : (
    <span className="flex items-center gap-3">
      <img src={site.author.avatar} alt="" width={44} height={44} className="size-11 rounded-full object-cover" />
      <span className="flex flex-col text-[14px] leading-snug sm:text-[15px]">
        <span className="font-medium text-[var(--text)]">By {site.author.name}</span>
        <span className="text-[var(--text-muted)]">
          <Meta date={date} minutes={minutes} />
        </span>
      </span>
    </span>
  )
