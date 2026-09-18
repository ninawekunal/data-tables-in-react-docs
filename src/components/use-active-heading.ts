import { useEffect, useState } from 'react'
import type { Heading } from '@/lib/types'

/** The section being read: the last heading whose top is in the upper 40% of the viewport. */
export const useActiveHeading = (headings: Heading[]): string => {
  const [active, setActive] = useState('')

  useEffect(() => {
    if (headings.length === 0) return

    let frame = 0

    const update = () => {
      frame = 0
      const line = window.innerHeight * 0.4
      let current = headings[0].id

      for (const heading of headings) {
        const el = document.getElementById(heading.id)

        if (el && el.getBoundingClientRect().top <= line) current = heading.id
      }

      setActive(current)
    }

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [headings])

  return active
}
