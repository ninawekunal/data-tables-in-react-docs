import type { MouseEvent } from 'react'

/**
 * Section links cannot use a plain #id: the app runs on a hash router, so
 * "#id" is read as a route and bounces back to the home page. Scroll instead.
 */
export const scrollToSection = (event: MouseEvent<HTMLAnchorElement>, id: string): void => {
  event.preventDefault()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
