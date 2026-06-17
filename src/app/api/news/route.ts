import { NextResponse } from 'next/server'
export const runtime = 'edge'
export async function GET() {
  return NextResponse.json({ articles: [], count: 0, source: 'stub' })
}
export async function POST() {
  return NextResponse.json({ articles: [], inserted: 0, ok: true })
}
