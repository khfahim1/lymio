'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Boxes, Search, Download, Star, ArrowUpRight, ShieldCheck, Zap } from 'lucide-react'
import { toast } from 'sonner'

interface Mod {
  slug: string
  title: string
  description: string
  categories: string[]
  icon_url: string | null
  downloads: number
  page: string
  featured: boolean
  fallbackUrl: string
  category: string
  summary: string
  hasFallback: boolean
}

// ─── Curated mod list — always available even offline ─────────────────────────
const CURATED: Array<{ slug: string; name: string; summary: string; category: string; featured: boolean }> = [
  { slug: 'sodium', name: 'Sodium', summary: 'Modern rendering engine replacement that massively boosts FPS without changing gameplay.', category: 'Performance', featured: true },
  { slug: 'iris', name: 'Iris Shaders', summary: 'Shader support for Sodium — compatible with hundreds of OptiFine shaderpacks.', category: 'Visuals', featured: true },
  { slug: 'fabric-api', name: 'Fabric API', summary: 'Core library for the Fabric modding toolchain. Required by most Fabric mods.', category: 'Library', featured: true },
  { slug: 'lithium', name: 'Lithium', summary: 'General-purpose optimization mod for server and client with no gameplay changes.', category: 'Performance', featured: true },
  { slug: 'create', name: 'Create', summary: 'Build working machines with kinetic power, cogwheels, fans, and full automation systems.', category: 'Technology', featured: true },
  { slug: 'jei', name: 'Just Enough Items', summary: 'View item recipes and uses for every mod in a clean, searchable in-game interface.', category: 'Utility', featured: false },
  { slug: 'xaeros-minimap', name: "Xaero's Minimap", summary: 'Clean, highly configurable minimap with waypoint system rendered directly in your HUD.', category: 'Utility', featured: false },
  { slug: 'waystones', name: 'Waystones', summary: 'Fast-travel around your Minecraft world using craftable Waystone teleport blocks.', category: 'Adventure', featured: false },
  { slug: 'appleskin', name: 'AppleSkin', summary: 'Adds food saturation and exhaustion info to HUD and tooltips for better survival planning.', category: 'Utility', featured: false },
  { slug: 'biomes-o-plenty', name: "Biomes O' Plenty", summary: 'Adds dozens of unique colorful biomes with new blocks, plants, trees and mobs to explore.', category: 'Adventure', featured: false },
  { slug: 'journeymap', name: 'JourneyMap', summary: 'Real-time mapping rendered in-game and in your browser as you explore the world.', category: 'Utility', featured: false },
  { slug: 'ferrite-core', name: 'FerriteCore', summary: 'Memory usage optimizations for Minecraft — significantly reduces RAM consumption.', category: 'Performance', featured: false },
]

function buildStaticMods(): Mod[] {
  return CURATED.map((m) => ({
    slug: m.slug,
    title: m.name,
    description: m.summary,
    summary: m.summary,
    categories: [m.category.toLowerCase()],
    category: m.category,
    icon_url: null,
    downloads: 0,
    page: `https://modrinth.com/mod/${m.slug}`,
    featured: m.featured,
    hasFallback: true,
    fallbackUrl: `https://modrinth.com/mod/${m.slug}`,
  }))
}

// ─── Fetch live data from Modrinth directly in browser ────────────────────────
const MODRINTH_API = 'https://api.modrinth.com/v2'

async function fetchModrinthLive(): Promise<Mod[] | null> {
  try {
    const slugs = CURATED.map((m) => m.slug)
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 9000)
    const res = await fetch(
      `${MODRINTH_API}/projects?ids=${encodeURIComponent(JSON.stringify(slugs))}`,
      {
        headers: { 'User-Agent': 'Lymio/1.0 (mods@lymio.app)' },
        signal: controller.signal,
      }
    )
    clearTimeout(t)
    if (!res.ok) return null
    const projects: any[] = await res.json()
    if (!Array.isArray(projects) || projects.length === 0) return null

    const map = new Map(projects.map((p) => [p.slug, p]))
    const merged = CURATED.map((fb) => {
      const p = map.get(fb.slug)
      return {
        slug: fb.slug,
        title: p?.title ?? fb.name,
        description: p?.description ?? fb.summary,
        summary: fb.summary,
        categories: Array.isArray(p?.categories) ? p.categories : [fb.category.toLowerCase()],
        category: fb.category,
        icon_url: typeof p?.icon_url === 'string' ? p.icon_url : null,
        downloads: typeof p?.downloads === 'number' ? p.downloads : 0,
        page: `https://modrinth.com/mod/${fb.slug}`,
        featured: fb.featured,
        hasFallback: true,
        fallbackUrl: `https://modrinth.com/mod/${fb.slug}`,
      }
    })
    merged.sort((a, b) => {
      if (a.featured && !b.featured) return -1
      if (!a.featured && b.featured) return 1
      return b.downloads - a.downloads
    })
    return merged
  } catch {
    return null
  }
}

// ─── Component ─────────────────────────────────────────────────────────────
export function ModsSection() {
  const [mods, setMods] = useState<Mod[]>(buildStaticMods())
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [redirecting, setRedirecting] = useState<string | null>(null)

  useEffect(() => {
    fetchModrinthLive()
      .then((live) => {
        if (live && live.length > 0) setMods(live)
      })
      .catch(() => { /* keep static */ })
      .finally(() => setLoading(false))
  }, [])

  // ─── Direct browser redirect — no API route needed ────────────────────────
  const handleModClick = async (mod: Mod) => {
    setRedirecting(mod.slug)
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`${MODRINTH_API}/project/${mod.slug}`, {
        headers: { 'User-Agent': 'Lymio/1.0' },
        signal: controller.signal,
      })
      clearTimeout(t)
      if (res.ok) {
        toast.success(`Opening ${mod.title} on Modrinth`)
        window.open(`https://modrinth.com/mod/${mod.slug}`, '_blank', 'noopener,noreferrer')
      } else {
        toast.info(`${mod.title} not found on Modrinth — redirecting to fallback`)
        window.open(mod.fallbackUrl, '_blank', 'noopener,noreferrer')
      }
    } catch {
      // Even if check fails, open Modrinth (likely the slug is valid)
      window.open(`https://modrinth.com/mod/${mod.slug}`, '_blank', 'noopener,noreferrer')
    } finally {
      setRedirecting(null)
    }
  }

  const filtered = mods.filter(
    (m) =>
      !query ||
      m.title.toLowerCase().includes(query.toLowerCase()) ||
      m.description.toLowerCase().includes(query.toLowerCase()) ||
      m.categories.some((c) => c.includes(query.toLowerCase()))
  )

  const featured = filtered.filter((m) => m.featured)
  const rest = filtered.filter((m) => !m.featured)

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md border border-emerald-500/20 shadow-[2px_2px_0px_#10b981] lymio-grass-top grid place-items-center">
            <Boxes className="h-5 w-5 text-stone-950" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">Smart Mods Directory</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              Auto-redirects to Modrinth · fallback repositories configured
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mods..."
            className="pl-9 border-2 border-border/80 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/50 bg-background/50 rounded-md"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="lymio-3d-card rounded-xl p-4 bg-card/40 border border-border/40">
              <div className="flex gap-3">
                <Skeleton className="h-14 w-14 rounded-md" />
                <div className="flex-1 space-y-2.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {featured.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-4 flex items-center gap-1.5">
                <Star className="h-4 w-4 text-amber-400 fill-amber-400" /> Essential Picks
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {featured.map((m) => (
                  <ModCard key={m.slug} mod={m} onClick={() => handleModClick(m)} redirecting={redirecting === m.slug} featured />
                ))}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Trending on Modrinth</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.map((m) => (
                  <ModCard key={m.slug} mod={m} onClick={() => handleModClick(m)} redirecting={redirecting === m.slug} />
                ))}
              </div>
            </div>
          )}
          {filtered.length === 0 && (
            <div className="lymio-3d-card p-12 text-center text-muted-foreground rounded-xl">
              <Boxes className="h-10 w-10 mx-auto mb-3 opacity-30 text-emerald-400" />
              No mods match &quot;{query}&quot;.
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function ModCard({
  mod, onClick, redirecting, featured,
}: {
  mod: Mod; onClick: () => void; redirecting: boolean; featured?: boolean
}) {
  return (
    <div
      className={`lymio-3d-card p-4 rounded-xl cursor-pointer group flex flex-col justify-between ${
        featured
          ? 'border-amber-500/40 bg-amber-500/5 shadow-[5px_5px_0px_rgba(245,158,11,0.22)] hover:shadow-[7px_7px_0px_rgba(245,158,11,0.4)] hover:border-amber-500/50'
          : 'border-border/60 bg-card/60'
      }`}
      onClick={onClick}
    >
      <div className="flex gap-3">
        <div className="h-14 w-14 rounded-md overflow-hidden bg-emerald-950/20 grid place-items-center shrink-0 border border-border/40 shadow-[1px_1px_0px_rgba(0,0,0,0.2)]">
          {mod.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mod.icon_url}
              alt={mod.title}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <Boxes className="h-6 w-6 text-emerald-500/60" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-base leading-tight truncate text-white group-hover:text-emerald-400 transition-colors">
              {mod.title}
            </h3>
            {featured && <Star className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">{mod.summary || mod.description}</p>
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <Badge variant="secondary" className="text-[9px] font-bold uppercase bg-stone-900 text-stone-300 py-0.5 px-1.5 border border-border/40">
              {mod.category || mod.categories[0] || 'mod'}
            </Badge>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
              <Download className="h-3 w-3 text-stone-500" /> {formatNum(mod.downloads)}
            </span>
            {mod.hasFallback && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 font-bold">
                <ShieldCheck className="h-3 w-3" /> fallback ready
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        className={`w-full mt-4 text-xs py-2 flex items-center justify-center gap-1.5 ${featured ? 'lymio-3d-button-amber' : 'lymio-3d-button'}`}
        disabled={redirecting}
        onClick={(e) => { e.stopPropagation(); onClick() }}
      >
        {redirecting ? (
          <>Resolving best source...</>
        ) : (
          <>Get Mod <ArrowUpRight className="h-3.5 w-3.5" /></>
        )}
      </button>
    </div>
  )
}

function formatNum(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n === 0 ? 'Modrinth' : String(n)
}
