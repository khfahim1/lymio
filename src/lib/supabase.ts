const SUPABASE_URL = 'https://awsotqcmchbxvwasebck.supabase.co'
const SUPABASE_KEY = 'sb_publishable_FyOI1_LOGC_7kmCQ4qYsoQ_avGK2Pe8'
const SUPABASE_UMD_SRC = 'https://unpkg.com/@supabase/supabase-js@2'

type SupabaseClient = {
  from: (table: string) => SupabaseQueryBuilder
}

type SupabaseQueryBuilder = {
  select: (columns?: string) => SupabaseFilterBuilder
  insert: (rows: Record<string, unknown>[]) => SupabaseMutationBuilder
  update: (values: Record<string, unknown>) => SupabaseMutationBuilder
  delete: () => SupabaseMutationBuilder
  eq: (col: string, val: unknown) => SupabaseFilterBuilder
  order: (col: string, opts?: { ascending?: boolean }) => SupabaseFilterBuilder
  limit: (n: number) => SupabaseFilterBuilder
}

type SupabaseFilterBuilder = {
  then: <T>(resolve: (value: { data: T | null; error: unknown }) => unknown) => Promise<{ data: T | null; error: unknown }>
  eq: (col: string, val: unknown) => SupabaseFilterBuilder
  order: (col: string, opts?: { ascending?: boolean }) => SupabaseFilterBuilder
  limit: (n: number) => SupabaseFilterBuilder
}

type SupabaseMutationBuilder = {
  then: <T>(resolve: (value: { data: T | null; error: unknown }) => unknown) => Promise<{ data: T | null; error: unknown }>
  select: (columns?: string) => SupabaseMutationBuilder
}

declare global {
  interface Window {
    supabase?: {
      createClient: (url: string, key: string) => SupabaseClient
    }
    __supabaseClient?: SupabaseClient
  }
}

let scriptPromise: Promise<void> | null = null

function loadSupabaseScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Supabase can only initialize in the browser'))
  if (window.supabase?.createClient) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = Array.from(document.scripts).find((s) => s.src === SUPABASE_UMD_SRC)
    const script = existing ?? document.createElement('script')

    const onLoad = () => {
      if (window.supabase?.createClient) resolve()
      else reject(new Error('Supabase SDK initialization mismatch.'))
    }
    const onError = () => reject(new Error('Failed to load Supabase UMD script'))

    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })

    if (!existing) {
      script.src = SUPABASE_UMD_SRC
      script.async = true
      script.setAttribute('data-lymio-supabase', 'true')
      document.head.appendChild(script)
    } else {
      window.setTimeout(onLoad, 0)
    }
  })

  return scriptPromise
}

const getSupabaseClient = (): SupabaseClient => {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('Supabase SDK initialization mismatch.')
  }
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
}

export async function getSupabase(): Promise<SupabaseClient> {
  if (window.__supabaseClient) return window.__supabaseClient
  await loadSupabaseScript()
  window.__supabaseClient = getSupabaseClient()
  return window.__supabaseClient
}

export async function supabaseFetchAll(): Promise<Record<string, unknown>[]> {
  try {
    const sb = await getSupabase()
    const { data, error } = await sb.from('minecraft_accounts').select('*').order('created_at', { ascending: false })
    if (error) {
      console.error('[Supabase fetch all failed]', error)
      return []
    }
    return (data ?? []) as Record<string, unknown>[]
  } catch (err) {
    console.error('[Supabase fetch all error]', err)
    return []
  }
}

export async function supabaseInsert(row: Record<string, unknown>): Promise<boolean> {
  try {
    const sb = await getSupabase()
    const { error } = await sb.from('minecraft_accounts').insert([row])
    if (error) {
      console.error('[Supabase insert failed]', error)
      return false
    }
    return true
  } catch (err) {
    console.error('[Supabase insert error]', err)
    return false
  }
}

export async function supabaseUpdate(id: number | string, values: Record<string, unknown>): Promise<boolean> {
  try {
    const sb = await getSupabase()
    const { error } = await sb.from('minecraft_accounts').update(values).eq('id', id)
    if (error) {
      console.error('[Supabase update failed]', error)
      return false
    }
    return true
  } catch (err) {
    console.error('[Supabase update error]', err)
    return false
  }
}

export async function supabaseDelete(id: number | string): Promise<boolean> {
  try {
    const sb = await getSupabase()
    const { error } = await sb.from('minecraft_accounts').delete().eq('id', id)
    if (error) {
      console.error('[Supabase delete failed]', error)
      return false
    }
    return true
  } catch (err) {
    console.error('[Supabase delete error]', err)
    return false
  }
}
// GIT_TRACKING_MARKER: SUPABASE_UMD_WINDOW_SCOPE_FIX_2026_0617_v3