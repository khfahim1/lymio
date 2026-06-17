import { NextResponse } from 'next/server'
export const runtime = 'edge'
export async function POST() {
  return NextResponse.json({ ok: false, error: 'Use client-side auth' }, { status: 200 })
}
