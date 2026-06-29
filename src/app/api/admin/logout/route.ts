import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const response = NextResponse.redirect(`${origin}/admin/login`)
  response.cookies.delete('admin_session')
  return response
}
