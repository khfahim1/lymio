'use client'

import { useEffect, useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Gift, KeyRound, Eye, EyeOff, Copy, CheckCircle2, Lock,
  Sparkles, Timer, ShieldCheck, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AdsterraNativeBanner, AdsterraBanner728,
  triggerAdsterraPopunder, ADSTERRA_SMARTLINK,
} from './adsterra'
import { getSupabase } from '@/lib/supabase'

// ─── Popunder isolation — only fires when Premium tab is mounted ─────────────
const POPUNDER_SRC = 'https://pl29765365.effectivecpmnetwork.com/77/cf/1c/77cf1c4e1fb8891db96f7050dfcd6b52.js'
const POPUNDER_ID = 'adsterra-popunder-premium-tab'

function usePopunderIsolation() {
  useEffect(() => {
    if (document.getElementById(POPUNDER_ID)) return
    const script = document.createElement('script')
    script.id = POPUNDER_ID
    script.src = POPUNDER_SRC
    script.async = true
    document.head.appendChild(script)
    return () => {
      const el = document.getElementById(POPUNDER_ID)
      if (el) el.parentNode?.removeChild(el)
    }
  }, [])
}

// ─── Supabase account ops ─────────────────────────────────────────────────────
interface AccountRow {
  id: number
  email: string
  password: string
  claimed: boolean
  claimed_by: string | null
  created_at: string
}

async function getAvailableAccounts(): Promise<AccountRow[]> {
  try {
    const sb = await getSupabase()
    const { data, error } = await sb
      .from('minecraft_accounts')
      .select('*')
      .eq('claimed', false)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('[Supabase getAvailable failed]', error)
      return []
    }
    return (data ?? []) as AccountRow[]
  } catch (err) {
    console.error('[Supabase getAvailable error]', err)
    return []
  }
}

async function getAllAccounts(): Promise<AccountRow[]> {
  try {
    const sb = await getSupabase()
    const { data, error } = await sb.from('minecraft_accounts').select('*')
    if (error) {
      console.error('[Supabase getAll failed]', error)
      return []
    }
    return (data ?? []) as AccountRow[]
  } catch (err) {
    console.error('[Supabase getAll error]', err)
    return []
  }
}

async function markClaimed(id: number, username: string): Promise<boolean> {
  try {
    const sb = await getSupabase()
    const { error } = await sb
      .from('minecraft_accounts')
      .update({ claimed: true, claimed_by: username, claimed_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      console.error('[Supabase markClaimed failed]', error)
      return false
    }
    return true
  } catch (err) {
    console.error('[Supabase markClaimed error]', err)
    return false
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────
const REQUIRED_ADS = 5

const AD_STEPS = [
  { id: 1, type: 'popunder', label: 'Popunder Ad', format: 'Popunder', desc: 'Opens a sponsored tab' },
  { id: 2, type: 'smartlink', label: 'Smartlink Ad', format: 'Smartlink', desc: 'Sponsored offer page' },
  { id: 3, type: 'native-banner', label: 'Native Banner', format: 'Native Banner', desc: 'Native sponsored content' },
  { id: 4, type: 'social-bar', label: 'Social Bar', format: 'Social Bar', desc: 'Interactive social bar' },
  { id: 5, type: 'banner-728', label: 'Banner 728×90', format: 'Leaderboard', desc: 'Top leaderboard banner' },
] as const

interface AdEvent { type: string; timestamp: number; nonce: string }
interface ClaimedAccount { email: string; password: string }

// ─── Component ───────────────────────────────────────────────────────────────
export function PremiumSection() {
  usePopunderIsolation()

  const [available, setAvailable] = useState(0)
  const [claimed, setClaimed] = useState(0)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [adEvents, setAdEvents] = useState<AdEvent[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [username, setUsername] = useState('')
  const [claimedAccount, setClaimedAccount] = useState<ClaimedAccount | null>(null)
  const [showCreds, setShowCreds] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const loadStats = async () => {
    try {
      const all = await getAllAccounts()
      setAvailable(all.filter((a) => !a.claimed).length)
      setClaimed(all.filter((a) => a.claimed).length)
    } catch {
      /* keep zeros — non-fatal */
    }
  }

  useEffect(() => {
    loadStats()
    const t = setInterval(loadStats, 30000)
    return () => clearInterval(t)
  }, [])

  const startClaim = () => {
    if (available === 0) {
      toast.error('No premium accounts in stock right now — check back soon!')
      return
    }
    setAdEvents([])
    setCurrentStep(0)
    setClaimedAccount(null)
    setShowCreds(false)
    setSessionOpen(true)
  }

  const advanceAd = useCallback(async () => {
    if (currentStep >= REQUIRED_ADS || busy) return
    setBusy(true)
    const step = AD_STEPS[currentStep]

    if (step.type === 'popunder' || step.type === 'smartlink') {
      triggerAdsterraPopunder()
    } else if (step.type === 'native-banner') {
      const el = document.getElementById('container-50d1fcd3a1edd7913165b1288f79cc63')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('lymio-pulse')
      setTimeout(() => el?.classList.remove('lymio-pulse'), 2200)
    } else if (step.type === 'social-bar') {
      toast('Social Bar activated — interaction recorded', { duration: 1800 })
    } else if (step.type === 'banner-728') {
      const el = document.querySelector('[data-ad-slot="728x90"]')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('lymio-pulse')
      setTimeout(() => el?.classList.remove('lymio-pulse'), 2200)
    }

    setCountdown(2)
    await new Promise((r) => setTimeout(r, 2000))

    const ev: AdEvent = {
      type: step.type,
      timestamp: Date.now(),
      nonce: `${step.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }
    setAdEvents((prev) => [...prev, ev])
    setCurrentStep((s) => s + 1)
    setBusy(false)
    setCountdown(0)
    toast.success(`Ad ${currentStep + 1}/${REQUIRED_ADS} verified — ${step.format}`)
  }, [currentStep, busy])

  const finalizeClaim = async () => {
    if (adEvents.length < REQUIRED_ADS) { toast.error('Ad-wall not satisfied'); return }
    if (!username.trim()) { toast.error('Enter a username to claim your account'); return }
    setBusy(true)
    try {
      const pool = await getAvailableAccounts()
      if (!pool.length) {
        toast.error('No premium accounts available right now — check back later.')
        setBusy(false)
        return
      }
      const account = pool[0]

      const ok = await markClaimed(account.id, username.trim())
      if (ok) {
        setClaimedAccount({ email: account.email, password: account.password })
        setShowCreds(true)
        toast.success('Premium account unlocked! 🎉')
        await loadStats()
      } else {
        toast.error('Failed to claim account — please try again')
      }
    } catch (e) {
      toast.error('Claim failed — check your connection and try again')
    } finally {
      setBusy(false)
    }
  }

  const copyCreds = (text: string) => {
    try { navigator.clipboard?.writeText(text) } catch { /* ignore */ }
    toast.success('Copied to clipboard')
  }

  const resetSession = () => {
    setSessionOpen(false)
    setAdEvents([])
    setCurrentStep(0)
    setClaimedAccount(null)
    setShowCreds(false)
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-border/40">
        <div className="h-10 w-10 rounded-md border border-emerald-500/20 shadow-[2px_2px_0px_#10b981] lymio-grass-top grid place-items-center">
          <Gift className="h-5 w-5 text-stone-950" />
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">Free Premium Minecraft Accounts</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Lock className="h-3.5 w-3.5 text-amber-400" />
            Watch 5 ads to unlock · real Java &amp; Bedrock accounts · Adsterra monetized
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Vault visual */}
        <div className="lg:col-span-2 overflow-hidden border-2 border-emerald-500/30 bg-gradient-to-br from-stone-950 to-emerald-950/40 relative rounded-xl shadow-[5px_5px_0px_rgba(16,185,129,0.15)] hover:shadow-[7px_7px_0px_rgba(16,185,129,0.3)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/premium-vault.png" alt="Premium vault" className="absolute inset-0 h-full w-full object-cover opacity-35" />
          <div className="relative p-6 flex flex-col h-full min-h-[300px]">
            <div className="flex items-start justify-between">
              <div>
                <Badge className="bg-amber-500/25 text-amber-300 border border-amber-500/30 mb-2 py-0.5 px-2 font-bold">
                  <Sparkles className="h-3 w-3 mr-1" /> Premium Vault
                </Badge>
                <h3 className="text-2xl font-black text-white tracking-tight">Unlock a free premium account</h3>
                <p className="text-xs md:text-sm text-stone-300 mt-2.5 max-w-md leading-relaxed">
                  Our ad-wall gatekeeper requires you to view 5 distinct Adsterra ads. Once verified, a fresh account from the inventory is assigned to you — instantly.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6 max-w-sm">
              <div className="rounded-lg bg-stone-950/80 p-3.5 border-2 border-emerald-500/20 shadow-[3px_3px_0px_rgba(16,185,129,0.1)]">
                <div className="text-2xl font-bold text-emerald-400 lymio-pixel">{available}</div>
                <div className="text-[10px] text-stone-400 uppercase font-bold tracking-wider mt-0.5">Available now</div>
              </div>
              <div className="rounded-lg bg-stone-950/80 p-3.5 border-2 border-amber-500/20 shadow-[3px_3px_0px_rgba(245,158,11,0.1)]">
                <div className="text-2xl font-bold text-amber-400 lymio-pixel">{claimed}</div>
                <div className="text-[10px] text-stone-400 uppercase font-bold tracking-wider mt-0.5">Claimed total</div>
              </div>
            </div>
            <div className="mt-auto pt-8 flex flex-wrap gap-3">
              <button className="lymio-3d-button-amber px-6 py-2.5 text-sm font-bold flex items-center gap-2" onClick={startClaim} disabled={available === 0}>
                <KeyRound className="h-4 w-4" />
                {available === 0 ? 'Out of stock' : 'Claim Premium Account'}
              </button>
              <a href={ADSTERRA_SMARTLINK} target="_blank" rel="noopener noreferrer">
                <button className="lymio-3d-button-outline px-6 py-2.5 text-sm font-bold flex items-center gap-2">
                  Sponsored Offer
                </button>
              </a>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="lymio-3d-card rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 pb-3.5 border-b border-border/40 mb-4">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> How the gatekeeper works
            </h3>
            <div className="space-y-4 text-xs">
              {[
                ['1', 'Click "Claim Premium Account"'],
                ['2', 'View 5 distinct Adsterra ad formats'],
                ['3', 'Client verifies adSessionCount === 5'],
                ['4', 'Fresh account assigned & revealed'],
              ].map(([n, t]) => (
                <div key={n} className="flex gap-3 items-start">
                  <div className="h-5 w-5 rounded border border-emerald-500/30 lymio-grass-top grid place-items-center text-xs font-black text-stone-950 shrink-0">{n}</div>
                  <span className="text-stone-300 leading-normal">{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4 border-t border-border/40 text-[10px] text-muted-foreground leading-normal mt-4">
            Anti-cheat logic: events must span ≥3 ad formats &amp; be ≥1.5s apart.
          </div>
        </div>
      </div>

      {/* Ad-wall session dialog */}
      <Dialog open={sessionOpen} onOpenChange={(o) => { if (!o) resetSession() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto lymio-scroll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-400" />
              {claimedAccount ? 'Account Unlocked' : `Ad-Wall Gatekeeper · ${currentStep}/${REQUIRED_ADS}`}
            </DialogTitle>
            <DialogDescription>
              {claimedAccount
                ? 'Your premium account is ready below.'
                : 'View each ad fully. The counter advances only after a verified interaction.'}
            </DialogDescription>
          </DialogHeader>

          {!claimedAccount ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ad session progress</span>
                  <span className="font-mono text-emerald-400">{currentStep}/{REQUIRED_ADS}</span>
                </div>
                <Progress value={(currentStep / REQUIRED_ADS) * 100} className="h-2" />
              </div>
              <div className="space-y-2">
                {AD_STEPS.map((s, i) => {
                  const done = i < currentStep
                  const active = i === currentStep
                  return (
                    <div key={s.id} className={`flex items-center gap-3 rounded-md border p-2.5 transition-colors ${done ? 'border-emerald-500/40 bg-emerald-500/5' : active ? 'border-amber-500/50 bg-amber-500/5 lymio-pulse' : 'border-border/50 opacity-60'}`}>
                      <div className={`h-7 w-7 rounded grid place-items-center shrink-0 ${done ? 'bg-emerald-600' : 'bg-muted'}`}>
                        {done ? <CheckCircle2 className="h-4 w-4 text-white" /> : <span className="text-xs font-bold">{s.id}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{s.label}</div>
                        <div className="text-xs text-muted-foreground">{s.desc}</div>
                      </div>
                      {active && countdown > 0 && (
                        <Badge variant="outline" className="text-amber-400 border-amber-500/40">
                          <Timer className="h-3 w-3 mr-1" /> {countdown}s
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="rounded-md border border-border/50 p-3 space-y-3 bg-muted/20">
                <div className="text-xs font-semibold text-muted-foreground">Live Ad Zone</div>
                <AdsterraNativeBanner className="min-h-[90px] rounded bg-background/40" />
                <div className="hidden md:flex justify-center">
                  <AdsterraBanner728 className="min-h-[90px] w-full max-w-[728px] rounded bg-background/40" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="claim-user" className="text-xs font-bold text-stone-300">Your username (for assignment record)</Label>
                <Input
                  id="claim-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Steve_Player"
                  className="border-2 border-border/80 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/50 bg-background/40"
                />
              </div>
              <div className="flex gap-3 pt-2">
                {currentStep < REQUIRED_ADS ? (
                  <button className="flex-1 lymio-3d-button text-xs py-2.5" onClick={advanceAd} disabled={busy}>
                    {busy ? 'Verifying ad...' : `View Ad ${currentStep + 1} of ${REQUIRED_ADS}`}
                  </button>
                ) : (
                  <button
                    className="flex-1 lymio-3d-button-amber text-xs py-2.5 flex items-center justify-center gap-1.5"
                    onClick={finalizeClaim}
                    disabled={busy || !username.trim()}
                  >
                    <Gift className="h-4 w-4" /> {busy ? 'Claiming...' : 'Reveal My Account'}
                  </button>
                )}
                <button className="lymio-3d-button-outline px-4 py-2.5 text-xs" onClick={resetSession}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-950/20 p-4 shadow-[4px_4px_0px_rgba(16,185,129,0.1)]">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="font-bold text-emerald-300 text-sm">5 ads verified — account assigned</span>
                </div>
                <div className="space-y-3">
                  {(['email', 'password'] as const).map((field) => (
                    <div key={field}>
                      <Label className="text-xs font-bold text-stone-400 capitalize">{field}</Label>
                      <div className="flex gap-2.5 mt-1">
                        <Input
                          readOnly
                          value={showCreds ? claimedAccount[field] : '•••••••••••••••'}
                          className="font-mono border-2 border-border/80 bg-background/40"
                        />
                        <button className="lymio-3d-button-outline px-2.5" onClick={() => setShowCreds((s) => !s)}>
                          {showCreds ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button className="lymio-3d-button-outline px-2.5" onClick={() => copyCreds(claimedAccount[field])}>
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-200 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                Save these credentials now — they will not be shown again, and the account is removed from inventory.
              </div>
              <DialogFooter className="pt-2">
                <button className="lymio-3d-button px-5 py-2 text-xs font-bold w-full sm:w-auto" onClick={resetSession}>Done</button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
// GIT_TRACKING_MARKER: PREMIUM_SECTION_SUPABASE_2026_0617_v1