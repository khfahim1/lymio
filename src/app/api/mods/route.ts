import { NextResponse } from 'next/server'
export const runtime = 'edge'
export async function GET() {
  return NextResponse.json({ mods: [], count: 0, source: 'stub' })
}
