type ScoreRingProps = { correct: number; total: number }

export const ScoreRing = ({ correct, total }: ScoreRingProps) => {
  const pct = total === 0 ? 0 : Math.round((correct / total) * 100)
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const tone = pct >= 80 ? 'var(--ok)' : pct >= 60 ? 'var(--accent)' : 'var(--warn)'

  return (
    <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`Score ${pct} percent`}>
      <circle cx="56" cy="56" r={radius} fill="none" stroke="var(--border)" strokeWidth="9" />
      <circle
        cx="56"
        cy="56"
        r={radius}
        fill="none"
        stroke={tone}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(circumference * pct) / 100} ${circumference}`}
        transform="rotate(-90 56 56)"
      />
      <text
        x="56"
        y="52"
        textAnchor="middle"
        fontSize="24"
        fontWeight="700"
        fill="var(--text)"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {pct}%
      </text>
      <text x="56" y="70" textAnchor="middle" fontSize="12" fill="var(--text-muted)">
        {correct}/{total}
      </text>
    </svg>
  )
}
