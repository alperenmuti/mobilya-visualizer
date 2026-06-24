'use client'

export const ROOM_TYPES = [
  { id: '',         label: 'Otomatik',      en: '' },
  { id: 'salon',    label: 'Salon',         en: 'living room' },
  { id: 'yatak',    label: 'Yatak Odası',   en: 'bedroom' },
  { id: 'yemek',    label: 'Yemek Odası',   en: 'dining room' },
  { id: 'calisma',  label: 'Çalışma Odası', en: 'home office / study room' },
  { id: 'banyo',    label: 'Banyo',         en: 'bathroom' },
  { id: 'mutfak',   label: 'Mutfak',        en: 'kitchen' },
  { id: 'cocuk',    label: 'Çocuk Odası',   en: "children's bedroom" },
]

export function roomTypeToEn(id: string): string {
  return ROOM_TYPES.find(r => r.id === id)?.en ?? ''
}

interface Props {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

export default function RoomTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <div
      className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 overflow-x-auto"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}
    >
      <span className="text-[10px] font-medium whitespace-nowrap flex-shrink-0 mr-1" style={{ color: 'var(--muted-fg)' }}>
        Oda tipi:
      </span>
      {ROOM_TYPES.map(rt => (
        <button
          key={rt.id}
          onClick={() => onChange(rt.id)}
          disabled={disabled}
          className="whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-medium transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          style={{
            background: value === rt.id ? 'var(--accent)' : 'var(--card)',
            color: value === rt.id ? 'white' : 'var(--foreground)',
            border: `1px solid ${value === rt.id ? 'var(--accent)' : 'var(--border)'}`,
          }}
        >
          {rt.label}
        </button>
      ))}
    </div>
  )
}
