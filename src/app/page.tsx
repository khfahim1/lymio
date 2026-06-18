'use client'

import { useState } from 'react'
import { NewsSection } from '@/components/lymio/news-section'
import { ModsSection } from '@/components/lymio/mods-section'
import { PremiumSection } from '@/components/lymio/premium-section'
import { AdminSection } from '@/components/lymio/admin-section'
import { Newspaper, Blocks, Crown, Lock, Github, Twitter } from 'lucide-react'

type Tab = 'news' | 'mods' | 'premium' | 'admin'

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'mods', label: 'Mods', icon: Blocks },
  { id: 'premium', label: 'Premium', icon: Crown },
  { id: 'admin', label: 'Admin', icon: Lock },
]

export default function Home({
  initialTab = 'news',
  showAdminTab = false,
}: {
  initialTab?: Tab
  showAdminTab?: boolean
}) {
  const [tab, setTab] = useState<Tab>(initialTab)

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground lymio-grid-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b-2 border-border/80 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <a href="/" className="flex items-center gap-2.5 shrink-0 hover:scale-[1.02] transition-transform">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-lymio.png" alt="Lymio" className="h-9 w-9 border border-emerald-500/30 shadow-[2px_2px_0px_#10b981] rounded-md object-cover" />
              <div className="leading-none">
                <span className="text-xl font-black tracking-tight drop-shadow-[0_1px_0_rgba(16,185,129,0.2)]">Lymio</span>
                <span className="block text-[9px] text-emerald-400 font-bold uppercase tracking-wider lymio-pixel">Minecraft Voxel Hub</span>
              </div>
            </a>

            {/* Desktop tabs */}
            <nav className="hidden md:flex items-center gap-2 p-1.5 rounded-lg border border-border bg-stone-950/40">
              {TABS.filter((t) => t.id !== 'admin' || showAdminTab).map((t) => {
                const Icon = t.icon
                const active = tab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`relative px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                      active
                        ? 'bg-emerald-500 text-stone-950 border-emerald-600 shadow-[0_3px_0_0_#15803d] translate-y-[-1px]'
                        : 'bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                    {t.id === 'admin' && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />}
                  </button>
                )
              })}
            </nav>

            {/* Empty space for branding balance */}
            <div className="hidden sm:block w-[120px]" />
          </div>

          {/* Mobile tabs */}
          <nav className="md:hidden flex items-center gap-1.5 pb-2.5 overflow-x-auto lymio-scroll">
            {TABS.filter((t) => t.id !== 'admin' || showAdminTab).map((t) => {
              const Icon = t.icon
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    active
                      ? 'bg-emerald-500 text-stone-950 border-emerald-600 shadow-[0_2.5px_0_0_#15803d]'
                      : 'bg-stone-900/60 text-muted-foreground border-border/40 hover:bg-stone-850'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Hero — only on news tab */}
      {tab === 'news' && (
        <section className="relative overflow-hidden border-b-2 border-border/80 bg-stone-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/85 to-transparent" />
          <div className="relative container mx-auto max-w-7xl px-4 py-16 md:py-24">
            <div className="max-w-2xl border-2 border-stone-850 bg-stone-900/80 backdrop-blur-md p-6 md:p-8 rounded-xl shadow-[8px_8px_0px_#1c1917]">
              <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 font-bold mb-4">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live · Auto-updating Minecraft feed
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05] text-white">
                Everything Minecraft.<br />
                <span className="text-emerald-400 drop-shadow-[0_2px_0_#15803d]">Zero cloud cost.</span>
              </h1>
              <p className="mt-4 text-muted-foreground text-base md:text-lg max-w-xl">
                Automated news, smart mod redirection, and free premium accounts — built with 3D voxel precision for the Minecraft community.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => setTab('premium')} className="lymio-3d-button-amber px-5 py-2.5 text-sm flex items-center gap-2">
                  <Crown className="h-4 w-4" /> Claim Free Premium
                </button>
                <button onClick={() => setTab('mods')} className="lymio-3d-button-outline px-5 py-2.5 text-sm flex items-center gap-2">
                  <Blocks className="h-4 w-4" /> Browse Mods
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main content */}
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8">
        {tab === 'news' && <NewsSection />}
        {tab === 'mods' && <ModsSection />}
        {tab === 'premium' && <PremiumSection />}
        {tab === 'admin' && <AdminSection />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t-2 border-border bg-stone-950/80 backdrop-blur-md">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-lymio.png" alt="Lymio" className="h-6 w-6 rounded border border-emerald-500/20 shadow-[1px_1px_0px_#10b981]" />
                <span className="font-black text-white">Lymio</span>
              </div>
              <p className="text-xs text-muted-foreground">Automated Minecraft community platform. News, mods, and premium.</p>
            </div>
            <div>
              <div className="font-bold mb-3 text-xs uppercase tracking-wider text-emerald-400">Features</div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="hover:text-emerald-400 transition-colors">Auto News Feed</li>
                <li className="hover:text-emerald-400 transition-colors">Smart Mod Redirects</li>
                <li className="hover:text-emerald-400 transition-colors">Premium Vault</li>
              </ul>
            </div>
            <div>
              <div className="font-bold mb-3 text-xs uppercase tracking-wider text-emerald-400">Sources</div>
              <ul className="space-y-1.5 text-xs">
                <li><a href="https://www.minecraft.net" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-emerald-400 transition-colors">minecraft.net</a></li>
                <li><a href="https://feedback.minecraft.net" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-emerald-400 transition-colors">feedback.minecraft.net</a></li>
                <li><a href="https://modrinth.com" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-emerald-400 transition-colors">Modrinth API</a></li>
              </ul>
            </div>
            <div>
              <div className="font-bold mb-3 text-xs uppercase tracking-wider text-emerald-400">Connect</div>
              <div className="flex gap-2.5">
                <a href="https://github.com" target="_blank" rel="noreferrer" className="h-8.5 w-8.5 rounded-md border border-stone-800 bg-stone-900 grid place-items-center hover:bg-emerald-600 hover:text-white transition-colors shadow-[2px_2px_0px_rgba(0,0,0,0.5)]"><Github className="h-4 w-4" /></a>
                <a href="https://twitter.com" target="_blank" rel="noreferrer" className="h-8.5 w-8.5 rounded-md border border-stone-800 bg-stone-900 grid place-items-center hover:bg-emerald-600 hover:text-white transition-colors shadow-[2px_2px_0px_rgba(0,0,0,0.5)]"><Twitter className="h-4 w-4" /></a>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">Not affiliated with Mojang or Microsoft.</p>
            </div>
          </div>
          <div className="mt-8 pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-2.5 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} Lymio — Built for the Minecraft community.</span>
            <span className="lymio-pixel text-emerald-400">v1.0</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
