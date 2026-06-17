'use client'
import { useState } from 'react'
import { Search, X, ExternalLink } from 'lucide-react'
import type { FurnitureItem } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  items: FurnitureItem[]
  loading?: boolean
  selected?: FurnitureItem | null
  onSelect: (item: FurnitureItem) => void
}

export default function FurnitureList({ items, loading, selected, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Tümü')

  const categories = ['Tümü', ...Array.from(new Set(items.map(i => i.category).filter(Boolean) as string[]))]

  const filtered = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === 'Tümü' || item.category === activeCategory
    return matchSearch && matchCat
  })

  if (loading) {
    return (
      <div className="flex flex-col h-full p-4 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-xl" style={{ border: '1px solid var(--border)' }}>
            <div className="skeleton w-16 h-16 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="skeleton h-3 rounded w-3/4" />
              <div className="skeleton h-2.5 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-fg)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Mobilya ara..."
            className="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl outline-none"
            style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={12} style={{ color: 'var(--muted-fg)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Categories */}
      {categories.length > 1 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors',
                activeCategory === cat
                  ? 'text-white'
                  : 'hover:bg-gray-100'
              )}
              style={activeCategory === cat
                ? { background: 'var(--accent)', color: 'white' }
                : { background: 'var(--muted)', color: 'var(--muted-fg)', border: '1px solid var(--border)' }
              }
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Count */}
      <div className="px-4 pb-2">
        <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{filtered.length} ürün</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm" style={{ color: 'var(--muted-fg)' }}>Ürün bulunamadı</p>
          </div>
        ) : (
          filtered.map(item => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:scale-[1.01]',
                selected?.id === item.id ? 'ring-2' : ''
              )}
              style={{
                background: selected?.id === item.id ? '#F5EFE6' : 'var(--card)',
                border: `1px solid ${selected?.id === item.id ? 'var(--accent)' : 'var(--border)'}`,
                '--tw-ring-color': 'var(--accent)',
              } as React.CSSProperties}
            >
              {/* Image */}
              <div
                className="w-16 h-16 rounded-lg flex-shrink-0 overflow-hidden"
                style={{ background: 'var(--muted)' }}
              >
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">🪑</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.name}</p>
                {item.category && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-fg)' }}>{item.category}</p>
                )}
                {item.price && (
                  <p className="text-xs font-semibold mt-1" style={{ color: 'var(--accent-dark)' }}>{item.price}</p>
                )}
              </div>

              {/* Link */}
              {item.product_url && (
                <a
                  href={item.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="p-1.5 rounded-lg flex-shrink-0 hover:bg-gray-100 transition-colors"
                >
                  <ExternalLink size={12} style={{ color: 'var(--muted-fg)' }} />
                </a>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
