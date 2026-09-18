import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardMeta, CardTitle } from '@/components/ui/card'
import { docs } from '@/lib/content'

const PITCH = [
  ['One running example', 'Meridian, a fictional trading app: a positions blotter, trade orders and a 50,000-row executions tape.'],
  ['Production lessons', 'Every part carries the bugs real table systems shipped, and the fix that stuck.'],
  ['Graded recall quiz', 'Fifteen scenario questions per part. You find out what you actually absorbed.'],
  ['Reads on a phone', 'Bionic reading, dark mode, and a sticky section dropdown on small screens.'],
] as const

export const Home = () => (
  <div>
    <section className="py-6">
      <h1 className="max-w-[20ch] text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[44px]">
        Data tables in React, from interview prompt to production.
      </h1>
      <p className="mt-4 max-w-[60ch] text-[17px] text-[var(--text-muted)]">
        A seven-part series on TanStack Table and shadcn/ui: sorting and paging, server-driven
        tables behind a BFF, virtualization, selection, cell design, row clicks and header filters.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {docs[0] && (
          <Link to={`/docs/${docs[0].slug}`}>
            <Button variant="primary">Start with part 1</Button>
          </Link>
        )}
        <Link to="/how-it-works">
          <Button variant="outline">About the series</Button>
        </Link>
      </div>
    </section>

    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PITCH.map(([title, body]) => (
        <Card key={title}>
          <p className="m-0 text-sm font-semibold">{title}</p>
          <p className="mb-0 mt-1.5 text-[13px] text-[var(--text-muted)]">{body}</p>
        </Card>
      ))}
    </div>

    <section className="mt-14">
      <h2 className="text-lg font-semibold tracking-tight">The seven parts</h2>
      <ol className="mt-4 space-y-3">
        {docs.map((entry) => (
          <li key={entry.slug}>
            <Link to={`/docs/${entry.slug}`} className="block cursor-pointer">
              <Card className="flex gap-4 transition-colors hover:border-[var(--primary)]">
                <span className="text-2xl font-semibold tabular-nums text-[var(--primary)]">
                  {String(entry.meta.part ?? 0).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <CardTitle>{entry.meta.title}</CardTitle>
                  <CardMeta className="mt-1">{entry.meta.summary}</CardMeta>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {entry.quiz.length > 0 && <Badge tone="primary">{entry.quiz.length}-question quiz</Badge>}
                    {entry.meta.minutes && <Badge>{entry.meta.minutes} min</Badge>}
                  </span>
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  </div>
)
