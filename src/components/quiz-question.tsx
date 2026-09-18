import { BionicText } from '@/components/bionic-text'
import { Button } from '@/components/ui/button'
import { CheckIcon, CrossIcon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import type { QuizItem } from '@/lib/types'

type QuizQuestionProps = {
  item: QuizItem
  index: number
  total: number
  picked: number[]
  locked: boolean
  onPick: (option: number) => void
  onCheck: () => void
  onNext: () => void
  isLast: boolean
  bionic: boolean
}

const answerSet = (item: QuizItem): number[] =>
  Array.isArray(item.answer) ? item.answer : [item.answer]

export const QuizQuestion = ({
  item,
  index,
  total,
  picked,
  locked,
  onPick,
  onCheck,
  onNext,
  isLast,
  bionic,
}: QuizQuestionProps) => {
  const correct = answerSet(item)
  const isMulti = item.multi === true || Array.isArray(item.answer)
  const gotItRight =
    locked && correct.length === picked.length && correct.every((i) => picked.includes(i))

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] tabular-nums">
          Question {index + 1} of {total}
        </span>
        {isMulti && (
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
            Select all that apply
          </span>
        )}
      </div>

      <p className="mb-4 text-[17px] font-medium leading-snug">
        <BionicText text={item.q} on={bionic} />
      </p>

      <ul className="space-y-2">
        {item.options.map((option, optionIndex) => {
          const isPicked = picked.includes(optionIndex)
          const isCorrect = correct.includes(optionIndex)
          const show = locked && (isCorrect || isPicked)

          return (
            <li key={optionIndex}>
              <button
                type="button"
                disabled={locked}
                onClick={() => onPick(optionIndex)}
                className={cn(
                  'flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3 text-left text-[15px] leading-snug transition-colors',
                  'disabled:cursor-default',
                  show && isCorrect && 'border-[var(--ok)] bg-[var(--ok-soft)]',
                  show && !isCorrect && 'border-[var(--warn)] bg-[var(--warn-soft)]',
                  !show && isPicked && 'border-[var(--primary)] bg-[var(--primary-soft)]',
                  !show && !isPicked && 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]',
                )}
              >
                <span className="mt-0.5 shrink-0 text-[var(--text-muted)]">
                  {show && isCorrect ? (
                    <CheckIcon className="text-[var(--ok)]" />
                  ) : show ? (
                    <CrossIcon className="text-[var(--warn)]" />
                  ) : (
                    <span className="inline-block w-4 font-semibold tabular-nums">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                  )}
                </span>
                <span>
                  <BionicText text={option} on={bionic} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {locked && (
        <div className={cn('callout mt-4', gotItRight ? 'callout-win' : 'callout-gotcha')}>
          <span className="callout-label">{gotItRight ? 'Correct' : 'Not quite'}</span>
          <p className="m-0 text-[15px]">
            <BionicText text={item.expl} on={bionic} />
          </p>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        {locked ? (
          <Button variant="primary" onClick={onNext}>
            {isLast ? 'See my score' : 'Next question'}
          </Button>
        ) : (
          <Button variant="primary" disabled={picked.length === 0} onClick={onCheck}>
            Check answer
          </Button>
        )}
      </div>
    </div>
  )
}
