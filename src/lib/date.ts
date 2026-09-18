const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "2026-09-17" -> "Sep 17, 2026". Built by hand rather than with Intl so the
 * string never depends on the reader's locale or time zone.
 */
export const formatDate = (iso: string): string => {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) return iso

  const month = MONTHS[Number(match[2]) - 1]

  return month ? `${month} ${Number(match[3])}, ${match[1]}` : iso
}
