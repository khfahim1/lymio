'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShieldAlert, Lock, KeyRound, Plus, Trash2, LogOut, Database, Package, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabaseFetchAll, supabaseInsert, supabaseDelete } from '@/lib/supabase'

const STEP1 = '67439'
const STEP2 = 'Elitebook@2.3'

interface Account {
  id: number
  email: string
  password: string
  claimed: boolean
  claimed_by: string | null
  created_at: string
}

function fromSupabaseRow(row: Record<string, unknown>): Account {
  return {
    id: Number(row.id) ?? 0,
    email: (row.email as string) ?? '',
    password: (row.password as string) ?? '',
    claimed: (row.claimed as boolean) ?? false,
    claimed_by: (row.claimed_by as string) ?? null,
    created_at: (row.created_at as string) ?? '',
  }
}

async function fsGet(): Promise<Account[]> {
  const docs = await supabaseFetchAll()
  return docs.map(fromSupabaseRow)
}

async function fsAdd(email: string, password: string): Promise<void> {
  const ok = await supabaseInsert({ email, password })
  if (!ok) throw new Error('Supabase insert rejected')
}

async function fsDel(id: number): Promise<void> {
  const ok = await supabaseDelete(id)
  if (!ok) throw new Error('Supabase delete rejected')
}

export function AdminSection() {
  const [step1, setStep1] = useState('')
  const [step2, setStep2] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authing, setAuthing] = useState(false)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ available: 0, claimed: 0, total: 0 })
  const [showPasswords, setShowPasswords] = useState(false)

  const [singleEmail, setSingleEmail] = useState('')
  const [singlePassword, setSinglePassword] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [deleteEmail, setDeleteEmail] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('lymio_admin_ok')
    if (saved === '1') {
      setAuthed(true)
      loadAccounts()
    }
  }, [])

  const verify = async () => {
    setAuthing(true)
    try {
      await new Promise((r) => setTimeout(r, 400))
      if (step1.trim() === STEP1 && step2.trim() === STEP2) {
        localStorage.setItem('lymio_admin_ok', '1')
        setAuthed(true)
        toast.success('Admin access granted')
        await loadAccounts()
      } else {
        toast.error('Invalid credentials')
      }
    } finally {
      setAuthing(false)
    }
  }

  const logout = () => {
    setAuthed(false)
    setStep1('')
    setStep2('')
    setAccounts([])
    localStorage.removeItem('lymio_admin_ok')
  }

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const docs = await fsGet()
      setAccounts(docs)
      setStats({
        available: docs.filter((d) => !d.claimed).length,
        claimed: docs.filter((d) => d.claimed).length,
        total: docs.length,
      })
    } catch (e) {
      toast.error('Failed to load accounts — check Supabase connection')
    } finally {
      setLoading(false)
    }
  }

  const addSingleAccount = async () => {
    if (!singleEmail.trim() || !singlePassword.trim()) {
      toast.error('Email and password are required')
      return
    }
    const existing = accounts.find((a) => a.email === singleEmail.trim())
    if (existing) { toast.error('Account already exists'); return }
    try {
      await fsAdd(singleEmail.trim(), singlePassword.trim())
      toast.success('Account added')
      setSingleEmail('')
      setSinglePassword('')
      await loadAccounts()
    } catch (error) {
      console.error('[Supabase single account submit failed]', error)
      toast.error('Failed to add account')
    }
  }

  const addBulkAccounts = async () => {
    if (!bulkText.trim()) { toast.error('Paste at least one account (email:password per line)'); return }
    const existingEmails = new Set(accounts.map((a) => a.email))
    const pairs = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const sep = l.includes('----') ? '----' : l.includes('|') ? '|' : ':'
        const [email, ...rest] = l.split(sep)
        return { email: (email ?? '').trim(), password: rest.join(sep).trim() }
      })
      .filter((p) => p.email && p.password)

    if (!pairs.length) { toast.error('No valid email:password lines found'); return }

    let created = 0; let skipped = 0; let failed = 0
    for (const p of pairs) {
      if (existingEmails.has(p.email)) { skipped++; continue }
      try { await fsAdd(p.email, p.password); created++; existingEmails.add(p.email) } catch (error) { console.error('[Supabase bulk account submit failed]', error); failed++ }
    }
    if (created > 0 && failed > 0) {
      toast.warning(`Added ${created} accounts (${skipped} skipped, ${failed} failed)`)
    } else if (created > 0) {
      toast.success(`Added ${created} accounts (${skipped} skipped)`)
    } else {
      toast.error(`No accounts added (${skipped} skipped, ${failed} failed)`)
    }
    setBulkText('')
    await loadAccounts()
  }

  const removeByEmail = async () => {
    if (!deleteEmail.trim()) { toast.error('Enter email to remove'); return }
    const match = accounts.find((a) => a.email === deleteEmail.trim())
    if (!match) { toast.error('Account not found'); return }
    try {
      await fsDel(match.id)
      toast.success('Account removed')
      setDeleteEmail('')
      await loadAccounts()
    } catch { toast.error('Failed to remove account') }
  }

  const removeById = async (id: number) => {
    try {
      await fsDel(id)
      toast.success('Account removed')
      await loadAccounts()
    } catch { toast.error('Failed to remove account') }
  }

  if (!authed) {
    return (
      <div className="lymio-3d-card max-w-md mx-auto border-amber-500/40 bg-stone-950/80 p-6 rounded-xl shadow-[5px_5px_0px_rgba(245,158,11,0.2)]">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/40">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <h3 className="font-black text-lg text-white">Admin Vault Access</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-stone-300">Step 1 — Access passcode</Label>
            <Input
              type="password"
              value={step1}
              onChange={(e) => setStep1(e.target.value)}
              placeholder="Enter access passcode"
              className="border-2 border-border/80 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/50 bg-background/40"
              onKeyDown={(e) => e.key === 'Enter' && document.getElementById('admin-step2')?.focus()}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold text-stone-300">Step 2 — Admin unlock key</Label>
            <Input
              id="admin-step2"
              type="password"
              value={step2}
              onChange={(e) => setStep2(e.target.value)}
              placeholder="Enter admin unlock key"
              className="border-2 border-border/80 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/50 bg-background/40"
              onKeyDown={(e) => e.key === 'Enter' && verify()}
            />
          </div>
          <button
            className="w-full lymio-3d-button-amber text-xs py-2.5 flex items-center justify-center gap-1.5 mt-2"
            onClick={verify}
            disabled={authing || !step1 || !step2}
          >
            <Lock className="h-4 w-4" /> {authing ? 'Verifying...' : 'Unlock Admin Panel'}
          </button>
          <p className="text-[10px] text-muted-foreground text-center leading-normal">
            Two-step authentication. Restricted to the owner.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md border border-emerald-500/20 shadow-[2px_2px_0px_#10b981] lymio-grass-top grid place-items-center">
            <Database className="h-5 w-5 text-stone-950" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">Admin Panel</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Manage premium account inventory</p>
          </div>
        </div>
        <button className="lymio-3d-button-outline px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5" onClick={logout}>
          <LogOut className="h-4 w-4" /> Lock
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="lymio-3d-card p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 shadow-[4px_4px_0px_rgba(16,185,129,0.1)]">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold"><Package className="h-3.5 w-3.5" /> Available</div>
          <div className="text-2xl font-bold lymio-pixel mt-1 text-emerald-400">{stats.available}</div>
        </div>
        <div className="lymio-3d-card p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 shadow-[4px_4px_0px_rgba(245,158,11,0.1)]">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold"><KeyRound className="h-3.5 w-3.5" /> Claimed</div>
          <div className="text-2xl font-bold lymio-pixel mt-1 text-amber-400">{stats.claimed}</div>
        </div>
        <div className="lymio-3d-card p-4 rounded-xl border border-border/80 bg-stone-900/40">
          <div className="flex items-center gap-2 text-stone-400 text-xs font-bold"><Database className="h-3.5 w-3.5" /> Total</div>
          <div className="text-2xl font-bold lymio-pixel mt-1 text-white">{stats.total}</div>
        </div>
      </div>

      <div className="lymio-3d-card rounded-xl p-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-border/40 mb-4">
          <Plus className="h-4 w-4 text-emerald-400" /> Manage Accounts
        </h3>
        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 bg-stone-950 p-1 border border-border/60 rounded-lg">
            <TabsTrigger value="single" className="cursor-pointer font-bold text-xs py-1.5">Single Account</TabsTrigger>
            <TabsTrigger value="bulk" className="cursor-pointer font-bold text-xs py-1.5">Bulk Add</TabsTrigger>
            <TabsTrigger value="remove" className="cursor-pointer font-bold text-xs py-1.5">Remove Account</TabsTrigger>
          </TabsList>
          <TabsContent value="single" className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="single-email" className="text-xs font-bold text-stone-300">Email Address</Label>
                <Input
                  id="single-email"
                  type="email"
                  placeholder="steve@example.com"
                  className="border-2 border-border/80 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/50 bg-background/50 rounded-md"
                  value={singleEmail}
                  onChange={(e) => setSingleEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="single-pass" className="text-xs font-bold text-stone-300">Password</Label>
                <Input
                  id="single-pass"
                  type="text"
                  placeholder="Enter password"
                  className="border-2 border-border/80 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/50 bg-background/50 rounded-md"
                  value={singlePassword}
                  onChange={(e) => setSinglePassword(e.target.value)}
                />
              </div>
            </div>
            <button className="lymio-3d-button px-5 py-2 text-xs font-bold w-full sm:w-auto flex items-center gap-1.5" onClick={addSingleAccount}>
              <Plus className="h-4 w-4" /> Add Account
            </button>
          </TabsContent>
          <TabsContent value="bulk" className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-stone-300">
                Paste accounts — one per line as <code className="bg-stone-900 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-[11px] border border-border/40">email:password</code>
              </Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border-2 border-border/80 bg-background/50 px-3 py-2 text-sm font-mono lymio-scroll focus-visible:ring-emerald-500 focus-visible:border-emerald-500/50"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'steve@example.com:mypassword123\nalex@example.com:secret456'}
              />
            </div>
            <button className="lymio-3d-button px-5 py-2 text-xs font-bold w-full sm:w-auto flex items-center gap-1.5" onClick={addBulkAccounts}>
              <Plus className="h-4 w-4" /> Add to inventory
            </button>
          </TabsContent>
          <TabsContent value="remove" className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="delete-email" className="text-xs font-bold text-stone-300">Email Address to Remove</Label>
              <Input
                id="delete-email"
                type="email"
                placeholder="steve@example.com"
                className="border-2 border-border/80 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/50 bg-background/50 rounded-md"
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">This will permanently delete any matching account credentials from the system.</p>
            </div>
            <button className="lymio-3d-button-amber px-5 py-2 text-xs font-bold w-full sm:w-auto flex items-center gap-1.5" onClick={removeByEmail}>
              <Trash2 className="h-4 w-4" /> Delete Account
            </button>
          </TabsContent>
        </Tabs>
      </div>

      <div className="lymio-3d-card rounded-xl p-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-400" /> Inventory
            {loading && <span className="text-[10px] text-muted-foreground font-normal">(loading...)</span>}
          </h3>
          <div className="flex items-center gap-2">
            <button className="lymio-3d-button-outline px-3 py-1.5 text-xs font-bold flex items-center gap-1.5" onClick={loadAccounts}>
              Refresh
            </button>
            <button className="lymio-3d-button-outline px-3 py-1.5 text-xs font-bold flex items-center gap-1.5" onClick={() => setShowPasswords((s) => !s)}>
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPasswords ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {accounts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            {loading ? 'Loading accounts...' : 'No accounts in inventory yet.'}
          </p>
        ) : (
          <ScrollArea className="h-[360px] lymio-scroll border border-border/50 bg-stone-950/45 rounded-lg">
            <Table>
              <TableHeader className="bg-stone-900/80">
                <TableRow className="border-b border-border/60">
                  <TableHead className="font-bold text-stone-300">Email</TableHead>
                  <TableHead className="font-bold text-stone-300">Password</TableHead>
                  <TableHead className="font-bold text-stone-300">Status</TableHead>
                  <TableHead className="font-bold text-stone-300">Claimed by</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id} className="border-b border-border/40 hover:bg-stone-900/20">
                    <TableCell className="font-mono text-xs text-stone-300">{a.email}</TableCell>
                    <TableCell className="font-mono text-xs text-stone-300">{showPasswords ? a.password : '••••••••'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={a.claimed ? 'outline' : 'secondary'}
                        className={!a.claimed
                          ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/20 font-bold'
                          : 'bg-amber-950/20 text-amber-400 border-amber-500/20 font-bold'}
                      >
                        {a.claimed ? 'claimed' : 'available'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.claimed_by ?? '—'}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => removeById(a.id)}
                        className="h-8 w-8 text-destructive hover:text-red-400 grid place-items-center rounded hover:bg-stone-900/60 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
// GIT_TRACKING_MARKER: ADMIN_SECTION_SUPABASE_2026_0617_v1