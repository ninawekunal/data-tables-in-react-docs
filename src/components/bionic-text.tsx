import { Fragment } from 'react'

const fixationLength = (word: string): number => {
  if (word.length <= 1) return word.length
  if (word.length <= 3) return 1
  if (word.length <= 6) return 2
  if (word.length <= 9) return 3

  return Math.ceil(word.length * 0.4)
}

/** The bionic transform for React-rendered text, mirroring lib/bionic for HTML. */
export const BionicText = ({ text, on }: { text: string; on: boolean }) => {
  if (!on) return <>{text}</>

  const parts = text.split(/([\p{L}\p{N}'’-]+)/gu)

  return (
    <span className="bionic">
      {parts.map((part, i) =>
        /^[\p{L}\p{N}'’-]+$/u.test(part) ? (
          <Fragment key={i}>
            <b className="fx">{part.slice(0, fixationLength(part))}</b>
            {part.slice(fixationLength(part))}
          </Fragment>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </span>
  )
}
