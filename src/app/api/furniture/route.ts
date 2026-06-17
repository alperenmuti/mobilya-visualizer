import { NextRequest } from 'next/server'

// In production this fetches from Supabase based on tenant
// For now returns demo data so the UI works without DB setup
export async function GET(_req: NextRequest) {
  // Try Supabase if configured
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await supabase
        .from('furniture_items')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error) return Response.json({ items: data ?? [] })
    } catch {}
  }

  // Demo data
  return Response.json({
    items: [
      { id: '1', name: 'Chester Koltuk', category: 'Koltuk', price: '12.500 ₺', image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200', product_url: null, created_at: '' },
      { id: '2', name: 'Minimalist Masa', category: 'Masa', price: '4.200 ₺', image_url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=200', product_url: null, created_at: '' },
      { id: '3', name: 'Ahşap Kitaplık', category: 'Depolama', price: '7.800 ₺', image_url: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?w=200', product_url: null, created_at: '' },
      { id: '4', name: 'Kadife Kanepe', category: 'Koltuk', price: '18.900 ₺', image_url: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=200', product_url: null, created_at: '' },
      { id: '5', name: 'Yemek Masası', category: 'Masa', price: '9.400 ₺', image_url: 'https://images.unsplash.com/photo-1616627561839-074385245ff6?w=200', product_url: null, created_at: '' },
      { id: '6', name: 'Yatak Odası Dolabı', category: 'Depolama', price: '22.000 ₺', image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200', product_url: null, created_at: '' },
      { id: '7', name: 'Avize', category: 'Aydınlatma', price: '3.200 ₺', image_url: 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=200', product_url: null, created_at: '' },
      { id: '8', name: 'Halı 200x300', category: 'Tekstil', price: '5.600 ₺', image_url: 'https://images.unsplash.com/photo-1528372444006-1bfc81acab11?w=200', product_url: null, created_at: '' },
    ]
  })
}
