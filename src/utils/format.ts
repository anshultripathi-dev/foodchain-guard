import { NOW, DAY } from './clock'

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

function ist(ms: number) {
  // Display everything in IST (UTC+5:30) regardless of the viewer's timezone.
  return new Date(ms + 5.5 * 3600_000)
}

export function fmtDate(ms: number | string): string {
  const d = ist(typeof ms === 'string' ? Date.parse(ms) : ms)
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
export function fmtShortDate(ms: number | string): string {
  const d = ist(typeof ms === 'string' ? Date.parse(ms) : ms)
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`
}
export function fmtTime(ms: number | string): string {
  const d = ist(typeof ms === 'string' ? Date.parse(ms) : ms)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
export function fmtDateTime(ms: number | string): string {
  return `${fmtDate(ms)} · ${fmtTime(ms)}`
}
export function fmtAgo(ms: number): string {
  const diff = NOW - ms
  if (diff < 0) return 'in future'
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}
export const fmtNum = (n: number) => n.toLocaleString('en-US')
export const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`

/** Calendar days between today (IST) and the expiry date. */
export function daysRemaining(expiry: string | number): number {
  const e = typeof expiry === 'string' ? Date.parse(expiry) : expiry
  const dayIdx = (ms: number) => Math.floor((ms + 5.5 * 3600_000) / DAY)
  return dayIdx(e) - dayIdx(NOW)
}

export function clamp(n: number, a = 0, b = 100): number {
  return Math.max(a, Math.min(b, n))
}

export function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  } catch { /* fall through */ }
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.appendChild(ta)
  ta.select()
  try { document.execCommand('copy') } catch { /* ignore */ }
  document.body.removeChild(ta)
  return Promise.resolve()
}

export function downloadText(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
