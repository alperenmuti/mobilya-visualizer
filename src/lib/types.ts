export interface Tenant {
  id: string
  name: string
  slug: string
  logo_url?: string
  primary_color?: string
  created_at: string
}

export interface FurnitureSource {
  id: string
  tenant_id: string
  name: string
  website_url: string
  created_at: string
}

export interface FurnitureItem {
  id: string
  source_id?: string
  tenant_id?: string
  name: string
  image_url: string
  product_url?: string
  category?: string
  price?: string
  description?: string
  created_at: string
}

export interface ClickPoint {
  x: number // 0-1 normalized
  y: number // 0-1 normalized
  pixelX: number
  pixelY: number
}

export interface AIJobStatus {
  status: 'idle' | 'uploading' | 'processing' | 'done' | 'error'
  message?: string
  resultUrl?: string
  error?: string
}
