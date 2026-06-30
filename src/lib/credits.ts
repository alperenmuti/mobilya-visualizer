import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Atomically deduct 1 credit. Returns ok=false when credits=0 or tenant not found. */
export async function deductCredit(slug: string): Promise<{ ok: boolean; remaining: number; reason?: string }> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('deduct_tenant_credit', { p_slug: slug })
  if (error) throw new Error(`Credit deduction failed: ${error.message}`)
  return data as { ok: boolean; remaining: number; reason?: string }
}

/** Get current credit balance for a tenant. Returns null if tenant not found. */
export async function getCredits(slug: string): Promise<number | null> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('tenants')
    .select('credits')
    .eq('slug', slug)
    .maybeSingle()
  return data?.credits ?? null
}

/** Add credits to a tenant (admin only — call from authed routes). */
export async function addCredits(id: string, amount: number): Promise<number> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('add_tenant_credits', { p_id: id, p_amount: amount })
  if (error) {
    // Fallback: plain update (if RPC not yet defined)
    const { data: t } = await supabase
      .from('tenants')
      .select('credits')
      .eq('id', id)
      .single()
    const newVal = (t?.credits ?? 0) + amount
    await supabase.from('tenants').update({ credits: newVal }).eq('id', id)
    return newVal
  }
  return data as number
}

/** Set credits to a specific value (admin). */
export async function setCredits(id: string, amount: number): Promise<void> {
  const supabase = getSupabase()
  await supabase.from('tenants').update({ credits: amount }).eq('id', id)
}
