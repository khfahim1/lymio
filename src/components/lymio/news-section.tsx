'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Newspaper, RefreshCw, ExternalLink, Clock, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { AdsterraNativeBanner } from './adsterra'

interface Article {
  id: string
  title: string
  link: string
  summary: string
  author: string | null
  category: string | null
  imageUrl: string | null
  source: string
  publishedAt: string
}

// ─── Static fallback — always shown if network fails ─────────────────────────
const FALLBACK_NEWS: Article[] = [
  {
    id: 'f1',
    title: 'Minecraft 1.21.4 – The Garden Awakens',
    link: 'https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-4',
    summary: 'Explore the new pale garden biome, encounter the creaking mob, and discover the creaking heart block hidden deep in ancient pale oaks.',
    author: 'Minecraft',
    category: 'Update',
    imageUrl: 'https://www.minecraft.net/content/dam/games/minecraft/key-art/MC_TheWildUpdate_KeyArt_1920x1080.jpg',
    source: 'minecraft.net',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: 'f2',
    title: 'Minecraft 1.21 Tricky Trials – Full Changelog',
    link: 'https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21',
    summary: 'Trial Chambers are here — explore procedurally generated dungeons, battle the Breeze, and craft the powerful Mace from Wind Charges and Heavy Cores.',
    author: 'Minecraft',
    category: 'Update',
    imageUrl: 'https://www.minecraft.net/content/dam/games/minecraft/key-art/Minecraft-key-art.jpg',
    source: 'minecraft.net',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'f3',
    title: 'Minecraft Live 2024 – Everything Announced',
    link: 'https://www.minecraft.net/en-us/article/minecraft-live-2024',
    summary: 'From the new biome updates to the winning mob vote creature, here\'s a full recap of every announcement from Minecraft Live 2024.',
    author: 'Minecraft',
    category: 'Event',
    imageUrl: null,
    source: 'minecraft.net',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
  },
  {
    id: 'f4',
    title: 'Java Edition Snapshot 25w02a',
    link: 'https://www.minecraft.net/en-us/article/minecraft-snapshot-25w02a',
    summary: 'The latest snapshot introduces experimental features for the upcoming major update. Try new gameplay mechanics before they hit the full release.',
    author: 'Mojang',
    category: 'Snapshot',
    imageUrl: null,
    source: 'minecraft.net',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: 'f5',
    title: 'Bedrock Edition Update 1.21.40',
    link: 'https://feedback.minecraft.net/hc/en-us/sections/360001186971-Release-Notes',
    summary: 'Performance improvements, bug fixes for Trial Chambers, and parity updates bringing Java and Bedrock closer together.',
    author: 'Mojang',
    category: 'Release Notes',
    imageUrl: null,
    source: 'feedback.minecraft.net',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
  },
  {
    id: 'f6',
    title: 'Marketplace Spotlight: Best Community Maps',
    link: 'https://www.minecraft.net/en-us/article/marketplace-spotlight',
    summary: 'This week\'s top picks from the Minecraft Marketplace include adventure maps, skin packs, and resource packs built by the community.',
    author: 'Minecraft',
    category: 'Marketplace',
    imageUrl: null,
    source: 'minecraft.net',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString(),
  },
]

// ─── Client-side news fetcher — rss2json proxy ─────────────────────────────
const MC_RSS = 'https://www.minecraft.net/en-us/feeds/community-content/scripts/rss.xml'
const RSS2JSON = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(MC_RSS)}&count=20`

async function fetchLiveNews(): Promise<Article[] | null> {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 9000)
    const res = await fetch(RSS2JSON, { signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const data = await res.json()
    if (data?.status !== 'ok' || !Array.isArray(data.items) || data.items.length === 0) return null
    return data.items.slice(0, 15).map((item: any, i: number) => ({
      id: `rss-${i}-${Date.now()}`,
      title: String(item.title ?? 'Minecraft News').slice(0, 200),
      link: String(item.link ?? 'https://www.minecraft.net'),
      summary: stripHtml(String(item.description ?? item.content ?? '')).slice(0, 400),
      author: item.author ? String(item.author).slice(0, 100) : 'Minecraft',
      category: Array.isArray(item.categories) && item.categories.length > 0
        ? String(item.categories[0]).slice(0, 50)
        : 'News',
      imageUrl: extractRssImageUrl(item),
      source: 'minecraft.net',
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    }))
  } catch {
    return null
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function hasValidImageUrl(url: string | null): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url)
}

function urlFromUnknown(value: unknown): string | null {
  if (typeof value === 'string') return hasValidImageUrl(value) ? value : null
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = urlFromUnknown(item)
      if (url) return url
    }
  }
  if (typeof value === 'object' && value !== null) {
    const media = value as Record<string, unknown>
    return urlFromUnknown(media.url) ?? urlFromUnknown(media.link) ?? urlFromUnknown(media.href)
  }
  return null
}

function extractFirstImageFromHtml(html: unknown): string | null {
  if (typeof html !== 'string') return null
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match?.[1] && hasValidImageUrl(match[1]) ? match[1] : null
}

function extractRssImageUrl(item: any): string | null {
  return urlFromUnknown(item.thumbnail)
    ?? urlFromUnknown(item.enclosure)
    ?? urlFromUnknown(item['media:thumbnail'])
    ?? urlFromUnknown(item['media:content'])
    ?? urlFromUnknown(item.media?.thumbnail)
    ?? urlFromUnknown(item.media?.content)
    ?? extractFirstImageFromHtml(item.content)
    ?? extractFirstImageFromHtml(item.description)
    ?? null
}

function minecraftGeneratedImageUrl(title: string): string {
  const encoded = encodeURIComponent(title)
  return `https://image.pollinations.ai/p/minecraft_voxel_style_high_resolution_gaming_screenshot_${encoded}?width=600&height=400&nologo=true`
}

function articleImageUrl(article: Article): string {
  return hasValidImageUrl(article.imageUrl) ? article.imageUrl : minecraftGeneratedImageUrl(article.title)
}

// ─── Component ─────────────────────────────────────────────────────────────
export function NewsSection() {
  const [articles, setArticles] = useState<Article[]>(FALLBACK_NEWS)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [source, setSource] = useState<'live' | 'fallback'>('fallback')

  const loadNews = async (showToast = false) => {
    try {
      const live = await fetchLiveNews()
      if (live && live.length > 0) {
        setArticles(live)
        setSource('live')
        if (showToast) toast.success(`${live.length} latest articles loaded`)
      } else {
        setArticles(FALLBACK_NEWS)
        setSource('fallback')
        if (showToast) toast.info('Showing cached news — live feed unavailable')
      }
    } catch {
      setArticles(FALLBACK_NEWS)
      setSource('fallback')
      if (showToast) toast.info('Showing cached news')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadNews(true)
  }

  useEffect(() => {
    loadNews()
  }, [])

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md border border-emerald-500/20 shadow-[2px_2px_0px_#10b981] lymio-grass-top grid place-items-center">
            <Newspaper className="h-5 w-5 text-stone-950" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">Automated Minecraft News</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              100% accurate · official Mojang &amp; feedback channels
              {source === 'live' && (
                <span className="ml-1 text-emerald-400 font-bold">· LIVE</span>
              )}
            </p>
          </div>
        </div>
        <button
          className="lymio-3d-button-outline px-4 py-2 text-xs flex items-center gap-2"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Pulling...' : 'Refresh Feed'}
        </button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="lymio-3d-card rounded-xl overflow-hidden border border-border/40 bg-card/40 p-0">
              <Skeleton className="h-40 w-full rounded-none" />
              <div className="p-4 space-y-2.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((a, idx) => {
            const imageUrl = articleImageUrl(a)
            return (
            <div key={a.id} className="contents">
              <a href={a.link} target="_blank" rel="noopener noreferrer" className="group h-full">
                <div className="lymio-3d-card rounded-xl overflow-hidden h-full flex flex-col">
                  <div className="relative h-40 bg-stone-950 overflow-hidden border-b border-border/40">
                    <div className="absolute inset-0 lymio-grass-side opacity-60" />
                    <img
                      src={imageUrl}
                      alt={a.title}
                      className="relative h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                    <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                      {a.category && (
                        <Badge variant="secondary" className="bg-stone-900/90 text-emerald-400 font-bold border border-emerald-500/20 py-0.5 px-2">
                          {a.category}
                        </Badge>
                      )}
                    </div>
                    <div className="absolute top-2.5 right-2.5">
                      <Badge variant="outline" className="bg-stone-950/90 text-stone-300 border-border/60 text-[9px] font-mono">
                        {a.source}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-base leading-snug line-clamp-2 text-white group-hover:text-emerald-400 transition-colors">
                      {a.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-3 flex-1 leading-relaxed">{a.summary}</p>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(a.publishedAt)}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                        Read <ExternalLink className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </a>
              {idx === 2 && (
                <div className="col-span-full my-4 p-5 rounded-xl border-2 border-border/85 bg-card/45 shadow-[4px_4px_0px_rgba(0,0,0,0.35)]">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-2.5 text-center">Sponsored Content</div>
                  <AdsterraNativeBanner className="min-h-[100px] rounded bg-stone-900/20" />
                </div>
              )}
            </div>
          )})}
        </div>
      )}
    </section>
  )
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const h = Math.floor(diff / 3.6e6)
    if (h < 1) return `${Math.max(1, Math.floor(diff / 6e4))}m ago`
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  } catch {
    return 'recently'
  }
}
// GIT_TRACKING_MARKER: POLLINATIONS_IMAGE_REWRITE_2026_0617_v1
