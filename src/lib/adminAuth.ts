export function getAdminAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = sessionStorage.getItem('admin_token') ?? ''
  if (!token) return {}
  return { 'Authorization': `Bearer ${token}` }
}
