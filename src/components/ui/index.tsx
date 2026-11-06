import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Copy, X } from 'lucide-react'
import { cn, copyText } from '../../utils/format'
import { useStore } from '../../state/store'
import type { BatchStatus, Severity } from '../../models/types'

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'vio' | 'mute'

export const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', info: 'text-brand', vio: 'text-vio', mute: 'text-slate-400',
}
export const TONE_BG: Record<Tone, string> = {
  ok: 'bg-ok/10 border-ok/30 text-ok', warn: 'bg-warn/10 border-warn/30 text-warn', bad: 'bg-bad/10 border-bad/35 text-bad',
  info: 'bg-brand/10 border-brand/30 text-brand', vio: 'bg-vio/10 border-vio/30 text-vio', mute: 'bg-slate-500/10 border-slate-500/25 text-slate-300',
}
export const TONE_SOLID: Record<Tone, string> = {
  ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', info: 'bg-brand', vio: 'bg-vio', mute: 'bg-slate-500',
}
export const TONE_HEX: Record<Tone, string> = {
  ok: '#34d399', warn: '#fbbf24', bad: '#f87171', info: '#22d3ee', vio: '#a78bfa', mute: '#64748b',
}

export const scoreTone = (v: number): Tone => (v >= 85 ? 'ok' : v >= 60 ? 'warn' : 'bad')

export function Card({
  title, subtitle, right, children, className, bodyClassName, glow, icon,
}: {
  title?: ReactNode; subtitle?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string; bodyClassName?: string; glow?: boolean; icon?: ReactNode
}) {
  return (
    <section className={cn('glass rounded-2xl', glow && 'glass-hi', className)}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-1">
          <div className="min-w-0">
            {title && (
              <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-slate-100">
                {icon}
                {title}
              </h3>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={cn('px-5 pb-5 pt-3', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Badge({ tone = 'mute', children, dot, pulse, className }: { tone?: Tone; children: ReactNode; dot?: boolean; pulse?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide', TONE_BG[tone], className)}>
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60', TONE_SOLID[tone])} style={{ animation: 'pulse-ring 1.6s ease-out infinite' }} />}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', TONE_SOLID[tone])} />
        </span>
      )}
      {children}
    </span>
  )
}

export function statusTone(s: BatchStatus | string): Tone {
  switch (s) {
    case 'VERIFIED': case 'VALID': case 'AUTHENTIC': case 'NORMAL': case 'SAFE': case 'RESOLVED': case 'SECURE': case 'OPERATIONAL': case 'COMPLETE': return 'ok'
    case 'IN TRANSIT': case 'WARNING': case 'NEAR EXPIRY': case 'WATCH': case 'INVESTIGATING': case 'IN_PROGRESS': case 'OPEN': return 'warn'
    case 'SUSPICIOUS': case 'EXPIRES TODAY': case 'ESCALATED': case 'COLD VIOLATION': case 'MEDIUM': return 'warn'
    case 'CONTAINED': return 'info'
    default: return 'bad'
  }
}
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = statusTone(status)
  return <Badge tone={tone} dot className={className}>{status}</Badge>
}
export const sevTone = (s: Severity): Tone => (s === 'LOW' ? 'info' : s === 'MEDIUM' ? 'warn' : s === 'HIGH' ? 'bad' : 'bad')
export function SeverityBadge({ s }: { s: Severity }) {
  return <Badge tone={sevTone(s)} className={s === 'CRITICAL' ? 'bg-bad/25 ring-1 ring-bad/50' : ''}>{s}</Badge>
}

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'ok' | 'outline'
export function Btn({
  variant = 'outline', size = 'md', icon, children, className, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-gradient-to-b from-brand to-sky-500 text-ink-950 font-semibold shadow-[0_0_24px_-6px_rgba(34,211,238,.7)] hover:brightness-110',
    ok: 'bg-ok/90 text-ink-950 font-semibold hover:bg-ok',
    danger: 'bg-bad/15 text-bad border border-bad/40 hover:bg-bad/25 font-semibold',
    outline: 'border border-line bg-white/[0.03] text-slate-200 hover:bg-white/[0.07] hover:border-slate-500/50',
    ghost: 'text-slate-300 hover:bg-white/[0.06]',
  }
  const sz = { sm: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-lg', md: 'px-3.5 py-2 text-[13px] gap-2 rounded-xl', lg: 'px-5 py-3 text-sm gap-2 rounded-xl' }[size]
  return (
    <button {...rest} className={cn('inline-flex items-center justify-center whitespace-nowrap transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40', v[variant], sz, className)}>
      {icon}
      {children}
    </button>
  )
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="label mb-1 text-brand">{eyebrow}</div>}
        <h1 className="text-[22px] font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ items, value, onChange, className }: { items: Array<{ id: T; label: ReactNode; badge?: ReactNode }>; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('mb-5 flex gap-1 overflow-x-auto rounded-xl border border-line bg-ink-900/60 p-1', className)}>
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={cn(
            'relative flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition',
            value === it.id ? 'text-white' : 'text-slate-400 hover:text-slate-200',
          )}
        >
          {value === it.id && <motion.span layoutId={`tab-${items.map((i) => i.id).join('')}`} className="absolute inset-0 rounded-lg border border-brand/30 bg-brand/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          <span className="relative flex items-center gap-2">{it.label}{it.badge}</span>
        </button>
      ))}
    </div>
  )
}

export function Stat({
  label, value, sub, tone = 'info', icon, onClick, trend,
}: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; icon?: ReactNode; onClick?: () => void; trend?: ReactNode }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp onClick={onClick} className={cn('glass group relative overflow-hidden rounded-2xl p-4 text-left', onClick && 'transition hover:border-brand/40')}>
      <div className={cn('absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl', TONE_SOLID[tone])} />
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        {icon && <span className={cn('opacity-80', TONE_TEXT[tone])}>{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-[26px] font-bold leading-none tracking-tight text-white tabular-nums">{value}</div>
        {trend}
      </div>
      {sub && <div className="mt-1.5 text-xs text-slate-400">{sub}</div>}
    </Comp>
  )
}

export function AnimatedNumber({ value, decimals = 0, duration = 900, suffix = '', prefix = '' }: { value: number; decimals?: number; duration?: number; suffix?: string; prefix?: string }) {
  const [v, setV] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const e = 1 - Math.pow(1 - p, 3)
      setV(a + (value - a) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{prefix}{v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>
}

export function ScoreRing({ value, size = 120, stroke = 10, label, tone, sub, max = 100 }: { value: number; size?: number; stroke?: number; label?: ReactNode; tone?: Tone; sub?: ReactNode; max?: number }) {
  const t = tone ?? scoreTone((value / max) * 100)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value / max))
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(148,163,184,.12)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={TONE_HEX[t]} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1), stroke .4s', filter: `drop-shadow(0 0 6px ${TONE_HEX[t]}88)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-bold tabular-nums text-white" style={{ fontSize: size * 0.26 }}>{label ?? Math.round(value)}</div>
        {sub && <div className="text-[10px] uppercase tracking-wider text-slate-400">{sub}</div>}
      </div>
    </div>
  )
}

export function Bar({ value, tone, className, height = 6 }: { value: number; tone?: Tone; className?: string; height?: number }) {
  const t = tone ?? scoreTone(value)
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-white/[0.07]', className)} style={{ height }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: TONE_HEX[t], transition: 'width .9s cubic-bezier(.2,.8,.2,1)', boxShadow: `0 0 10px ${TONE_HEX[t]}66` }} />
    </div>
  )
}

export function HashText({ hash, n = 10, full, className, label }: { hash: string; n?: number; full?: boolean; className?: string; label?: string }) {
  const [ok, setOk] = useState(false)
  const toast = useStore((s) => s.toast)
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5', className)}>
      <span className="mono truncate text-[12px] text-slate-300" title={hash}>{full || hash.length <= n * 2 ? hash : `${hash.slice(0, n)}…${hash.slice(-6)}`}</span>
      <button
        className="shrink-0 rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-brand"
        onClick={(e) => { e.stopPropagation(); copyText(hash); setOk(true); toast(`${label ?? 'Hash'} copied to clipboard`, 'ok'); setTimeout(() => setOk(false), 1400) }}
        aria-label="Copy"
      >
        {ok ? <Check size={12} className="text-ok" /> : <Copy size={12} />}
      </button>
    </span>
  )
}

export function Kv({ k, v, mono, className }: { k: ReactNode; v: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 border-b border-white/[0.05] py-2 text-[13px] last:border-0', className)}>
      <span className="shrink-0 text-slate-400">{k}</span>
      <span className={cn('min-w-0 text-right text-slate-100', mono && 'mono text-[12px]')}>{v}</span>
    </div>
  )
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  const tone: Record<string, string> = { ok: 'border-ok/40', bad: 'border-bad/50', warn: 'border-warn/40', info: 'border-brand/40' }
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[360px] max-w-[92vw] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            className={cn('glass pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] text-slate-100 shadow-xl', tone[t.tone])}
          >
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', { ok: 'bg-ok', bad: 'bg-bad', warn: 'bg-warn', info: 'bg-brand' }[t.tone])} />
            <span className="flex-1">{t.text}</span>
            <button onClick={() => dismiss(t.id)} className="text-slate-500 hover:text-white"><X size={14} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
            className={cn('glass max-h-[88vh] w-full overflow-auto rounded-2xl p-6', wide ? 'max-w-4xl' : 'max-w-xl')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10"><X size={18} /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-slate-400">{children}</div>
}

export function Check2({ ok, label }: { ok: boolean; label?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', ok ? 'text-ok' : 'text-bad')}>
      {ok ? <Check size={14} /> : <X size={14} />}
      {label}
    </span>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  )
}
