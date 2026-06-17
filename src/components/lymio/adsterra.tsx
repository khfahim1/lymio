'use client'

import Script from 'next/script'
import { useEffect, useRef } from 'react'

/**
 * Adsterra integration (App ID 5851493).
 * Embeds every script per the strict binding map:
 *  - Popunder (head)
 *  - Native Banner (body core)
 *  - Banner 728x90 (leaderboard)
 *  - Banner 160x300 (sidebar)
 *  - Social Bar (footer)
 *  - Smartlink (CTA target)
 */

export const ADSTERRA_SMARTLINK = 'https://www.effectivecpmnetwork.com/wat595zrkj?key=ef006337bd6acbd1755bc2c66f19bf80'

export function AdsterraSocialBar() {
  return (
    <Script
      id="adsterra-social-bar"
      src="https://pl29765368.effectivecpmnetwork.com/0b/09/08/0b0908d2e19152b629a5713e3c054079.js"
      strategy="afterInteractive"
    />
  )
}

/** Native Banner — renders into its own container. */
export function AdsterraNativeBanner({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Load invoke.js once, then it auto-populates any #container-50d1... div
    const id = 'adsterra-native-invoke'
    if (!document.getElementById(id)) {
      const s = document.createElement('script')
      s.id = id
      s.async = true
      s.setAttribute('data-cfasync', 'false')
      s.src = 'https://pl29765366.effectivecpmnetwork.com/50d1fcd3a1edd7913165b1288f79cc63/invoke.js'
      document.body.appendChild(s)
    }
  }, [])
  return (
    <div
      ref={ref}
      id="container-50d1fcd3a1edd7913165b1288f79cc63"
      className={className}
      aria-label="Sponsored content"
    />
  )
}

/** Leaderboard 728x90 banner */
export function AdsterraBanner728({ className = '' }: { className?: string }) {
  useEffect(() => {
    const id = 'adsterra-728-invoke'
    const key = 'c0b5e5aa13704fc0933f0e6deba3c0c3'
    if (!document.getElementById(id)) {
      // @ts-expect-error global ad object
      window.atOptions = window.atOptions || {}
      const s = document.createElement('script')
      s.id = id
      s.innerHTML = `atOptions = { 'key' : '${key}', 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };`
      document.body.appendChild(s)
      const invoke = document.createElement('script')
      invoke.src = `https://www.highperformanceformat.com/${key}/invoke.js`
      invoke.async = true
      document.body.appendChild(invoke)
    }
  }, [])
  return <div className={className} data-ad-slot="728x90" aria-label="Advertisement 728x90" />
}

/** Sidebar 160x300 banner */
export function AdsterraBanner160({ className = '' }: { className?: string }) {
  useEffect(() => {
    const id = 'adsterra-160-invoke'
    const key = '99433da526bdbd6e3ac495c5430f0213'
    if (!document.getElementById(id)) {
      const s = document.createElement('script')
      s.id = id
      s.innerHTML = `atOptions = { 'key' : '${key}', 'format' : 'iframe', 'height' : 300, 'width' : 160, 'params' : {} };`
      document.body.appendChild(s)
      const invoke = document.createElement('script')
      invoke.src = `https://www.highperformanceformat.com/${key}/invoke.js`
      invoke.async = true
      document.body.appendChild(invoke)
    }
  }, [])
  return <div className={className} data-ad-slot="160x300" aria-label="Advertisement 160x300" />
}

/** Triggers a popunder / smartlink open for the ad-wall loop. */
export function triggerAdsterraPopunder() {
  try {
    // The popunder script attaches a click listener to the document; simulate a user gesture
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
    document.dispatchEvent(evt)
  } catch (e) {
    /* no-op */
  }
  // Also open the smartlink in a new tab as a guaranteed ad interaction
  window.open(ADSTERRA_SMARTLINK, '_blank', 'noopener,noreferrer')
}
// GIT_TRACKING_MARKER: ADSTERRA_POPUNDER_ISOLATION_2026_0617_v1
