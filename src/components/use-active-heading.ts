import { useEffect, useState } from 'react'
import type { Heading } from '@/lib/types'

/** Tracks which section is in view so both TOCs can highlight it. */
export const useActiveHeading = (headings: Heading[]): string => {
  const [active, setActive] = useState('')

  useEffect(() => {
    if (headings.length === 0) return

    const seen = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.intersectionRatio)

        let best = ''
        let bestTop = Number.POSITIVE_INFINITY

        for (const heading of headings) {
          const el = document.getElementById(heading.id)

          if (!el) continue

          const top = el.getBoundingClientRect().top

          if (top <= 120 && top < bestTop) {
            // Keep the last heading whose top has passed the sticky header.
            best = heading.id
            bestTop = Number.NEGATIVE_INFINITY
          }
          if (best === '' && top > 0 && top < bestTop) {
            bestTop = top
            best = heading.id
          }
        }

        if (best) setActive(best)
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: [0, 0.25, 1] },
    )

    for (const heading of headings) {
      const el = document.getElementById(heading.id)

      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [headings])

  return active
}
