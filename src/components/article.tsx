import { useEffect, useMemo, useState } from 'react'
import { applyBionic } from '@/lib/bionic'
import { cn } from '@/lib/cn'

type ArticleProps = { html: string; bionic: boolean }

export const Article = ({ html, bionic }: ArticleProps) => {
  const [transformed, setTransformed] = useState<string | null>(null)

  useEffect(() => {
    // DOMParser is browser-only, so the transform runs after mount.
    setTransformed(bionic ? applyBionic(html) : null)
  }, [bionic, html])

  const output = useMemo(() => (bionic && transformed ? transformed : html), [bionic, html, transformed])

  return (
    <article
      className={cn('prose', bionic && transformed && 'bionic')}
      dangerouslySetInnerHTML={{ __html: output }}
    />
  )
}
