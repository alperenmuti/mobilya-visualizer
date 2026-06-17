import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies()
  cookieStore.delete('admin_session')
  redirect('/admin/login')
}
