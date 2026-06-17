/**
 * Shared admin authentication utility.
 * Must NOT import from any route file to avoid circular imports on edge runtime.
 */

const ADMIN_STEP1 = '67439'
const ADMIN_STEP2 = 'Elitebook@2.3'
const SECRET = `${ADMIN_STEP1}:${ADMIN_STEP2}`

export function issueAdminToken(): string {
  const window = Math.floor(Date.now() / 1000 / 600)
  return btoa(`${SECRET}:${window}`)
}

export function verifyAdminToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false
  try {
    const now = Math.floor(Date.now() / 1000 / 600)
    // Accept tokens up to 24 hours old (144 × 10-min windows)
    for (let i = 0; i <= 144; i++) {
      const expected = btoa(`${SECRET}:${now - i}`)
      if (token === expected) return true
    }
  } catch {
    /* ignore */
  }
  return false
}

export function checkAdminCredentials(step1: string, step2: string): boolean {
  return step1 === ADMIN_STEP1 && step2 === ADMIN_STEP2
}
