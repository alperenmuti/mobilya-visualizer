'use client'
import { useState, useEffect } from 'react'
import { Coins } from 'lucide-react'

interface Props {
  brand: string | null
  /** Increment to force a refresh after a generation */
  refreshKey?: number
}

export default function CreditBadge({ brand, refreshKey = 0 }: Props) {
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    if (!brand) return
    fetch(`/api/credits?brand=${encodeURIComponent(brand)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.credits !== undefined) setCredits(d.credits) })
      .catch(() => {})
  }, [brand, refreshKey])

  if (!brand || credits === null) return null

  const low = credits <= 10
  return (
    <span
      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{
        background: low ? '#FEF2F2' : '#F0FDF4',
        color: low ? '#DC2626' : '#16A34A',
        border: `1px solid ${low ? '#FECACA' : '#BBF7D0'}`,
      }}
      title="Kalan kontör"
    >
      <Coins size={11} /> {credits}
    </span>
  )
}
