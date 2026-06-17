import { NextResponse } from 'next/server'
export const runtime = 'edge'
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug') ?? ''
  return NextResponse.json({ url: `https://modrinth.com/mod/${slug}`, source: 'stub' })
}
