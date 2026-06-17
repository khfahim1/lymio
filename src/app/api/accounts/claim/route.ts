import { NextResponse } from 'next/server'
export const runtime = 'edge'
export async function POST() {
  return NextResponse.json({ ok: false, error: 'Use client-side Firestore' })
}
export async function GET() {
  return NextResponse.json({ available: 0, claimed: 0, requiredAds: 5 })
}
