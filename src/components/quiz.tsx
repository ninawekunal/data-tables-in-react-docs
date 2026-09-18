import { useCallback, useMemo, useState } from 'react'
import { QuizQuestion } from '@/components/quiz-question'
import { ScoreRing } from '@/components/score-ring'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { QuizItem } from '@/lib/types'

type QuizProps = { title: string; items: QuizItem[]; bionic: boolean }

const answerSet = (item: QuizItem): number[] =>
  Array.isArray(item.answer) ? item.answer : [item.answer]

const isRight = (item: QuizItem, picked: number[]): boolean => {
  const correct = answerSet(item)

  return correct.length === picked.length && correct.every((i) => picked.includes(i))
}

export const Quiz = ({ title, items, bionic }: QuizProps) => {
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [picks, setPicks] = useState<Record<number, number[]>>({})
  const [locked, setLocked] = useState<Record<number, boolean>>({})
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  const score = useMemo(
    () => items.reduce((n, item, i) => n + (isRight(item, picks[i] ?? []) ? 1 : 0), 0),
    [items, picks],
  )

  const reset = useCallback(() => {
    setIndex(0)
    setPicks({})
    setLocked({})
    setDone(false)
    setCopied(false)
    setStarted(true)
  }, [])

  const pick = useCallback(
    (option: number) => {
      const item = items[index]
      const isMulti = item.multi === true || Array.isArray(item.answer)

      setPicks((prev) => {
        const current = prev[index] ?? []

        if (!isMulti) return { ...prev, [index]: [option] }

        return {
          ...prev,
          [index]: current.includes(option)
            ? current.filter((i) => i !== option)
            : [...current, option],
        }
      })
    },
    [index, items],
  )

  const copyResult = useCallback(() => {
    const pct = Math.round((score / items.length) * 100)
    const line = `${title} - ${score}/${items.length} (${pct}%) on ${new Date().toISOString().slice(0, 10)}`

    void navigator.clipboard.writeText(line).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }, [items.length, score, title])

  if (items.length === 0) return null

  if (!started) {
    return (
      <Card className="mt-10">
        <h2 className="mt-0 text-lg font-semibold">Check your recall</h2>
        <p className="text-[15px] text-[var(--text-muted)]">
          {items.length} scenario questions, graded one at a time with an explanation after each.
          Reading this doc twice will not help you here; applying it will.
        </p>
        <Button variant="primary" className="mt-3" onClick={() => setStarted(true)}>
          Start the quiz
        </Button>
      </Card>
    )
  }

  if (done) {
    const pct = Math.round((score / items.length) * 100)
    const verdict =
      pct >= 80 ? 'You can teach this.' : pct >= 60 ? 'Solid, but reread the misses.' : 'Skimmed it. Go again.'

    return (
      <Card className="mt-10">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          <ScoreRing correct={score} total={items.length} />
          <div className="text-center sm:text-left">
            <h2 className="mt-0 text-lg font-semibold">{verdict}</h2>
            <p className="text-[15px] text-[var(--text-muted)]">
              {score} of {items.length} correct. The misses are listed below with the reasoning.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button variant="primary" onClick={copyResult}>
                {copied ? 'Copied' : 'Copy my result'}
              </Button>
              <Button variant="outline" onClick={reset}>
                Retake
              </Button>
            </div>
          </div>
        </div>

        <ol className="mt-6 space-y-3 border-t border-[var(--border)] pt-5">
          {items.map((item, i) => (
            <li key={i} className="text-[15px]">
              <span className="mr-2 font-semibold tabular-nums text-[var(--text-muted)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={isRight(item, picks[i] ?? []) ? 'text-[var(--ok)]' : 'text-[var(--warn)]'}>
                {isRight(item, picks[i] ?? []) ? 'Correct' : 'Missed'}
              </span>
              <span className="text-[var(--text-muted)]"> - {item.q}</span>
            </li>
          ))}
        </ol>
      </Card>
    )
  }

  return (
    <Card className="mt-10">
      <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-[width]"
          style={{ width: `${((index + (locked[index] ? 1 : 0)) / items.length) * 100}%` }}
        />
      </div>
      <QuizQuestion
        item={items[index]}
        index={index}
        total={items.length}
        picked={picks[index] ?? []}
        locked={locked[index] ?? false}
        isLast={index === items.length - 1}
        onPick={pick}
        onCheck={() => setLocked((prev) => ({ ...prev, [index]: true }))}
        onNext={() => (index === items.length - 1 ? setDone(true) : setIndex(index + 1))}
        bionic={bionic}
      />
    </Card>
  )
}
