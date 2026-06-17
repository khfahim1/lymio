import { NextResponse } from 'next/server'
export const runtime = 'edge'
export async function GET() {
  return NextResponse.json({ accounts: [], stats: { available: 0, claimed: 0, total: 0 } })
}
export async function POST() {
  return NextResponse.json({ ok: false, error: 'Use client-side Firestore' })
}
export async function DELETE() {
  return NextResponse.json({ ok: false, error: 'Use client-side Firestore' })
}
