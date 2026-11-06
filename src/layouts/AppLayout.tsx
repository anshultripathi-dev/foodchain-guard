import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity, AlertTriangle, Bell, Bot, Boxes, ChevronDown, FileText, FlaskConical, Fingerprint, Hourglass, LayoutDashboard, Link2, LogOut,
  Package, ScanLine, ScrollText, Search, Settings, ShieldAlert, ShieldCheck, Thermometer, Undo2, X, Zap,
} from 'lucide-react'
import { Link, navigate } from '../utils/router'
import { cn, fmtAgo } from '../utils/format'
import { useStore } from '../state/store'
import { useAnalysis, useSocStats } from '../state/selectors'
import { ROLES, ROLE_BY_ID, type NavId } from '../data/roles'
import { Badge, Btn, StatusBadge, Toasts, TONE_SOLID } from '../components/ui'
import { search } from '../services/search'
import { THREAT_LABEL } from '../models/types'

const NAV: Array<{ id: NavId; label: string; to: string; icon: ReactNode }> = [
  { id: 'overview', label: 'Overview', to: '/app/overview', icon: <LayoutDashboard size={17} /> },
  { id: 'supply-chain', label: '3D Supply Chain', to: '/app/supply-chain', icon: <Boxes size={17} /> },
  { id: 'batches', label: 'Batches', to: '/app/batches', icon: <Package size={17} /> },
  { id: 'identity', label: 'Digital Identity', to: '/app/identity', icon: <Fingerprint size={17} /> },
  { id: 'blockchain', label: 'Blockchain', to: '/app/blockchain', icon: <Link2 size={17} /> },
  { id: 'packaging', label: 'Packaging', to: '/app/packaging', icon: <ScanLine size={17} /> },
  { id: 'verification', label: 'Verification', to: '/app/verification', icon: <ShieldCheck size={17} /> },
  { id: 'anomalies', label: 'Anomalies', to: '/app/anomalies', icon: <AlertTriangle size={17} /> },
  { id: 'cold-chain', label: 'Cold Chain', to: '/app/cold-chain', icon: <Thermometer size={17} /> },
  { id: 'expiry', label: 'Expiry & Safety', to: '/app/expiry', icon: <Hourglass size={17} /> },
  { id: 'recall', label: 'Recall', to: '/app/recall', icon: <Undo2 size={17} /> },
  { id: 'soc', label: 'Security SOC', to: '/app/soc', icon: <ShieldAlert size={17} /> },
  { id: 'audit', label: 'Audit Logs', to: '/app/audit', icon: <ScrollText size={17} /> },
  { id: 'reports', label: 'Reports', to: '/app/reports', icon: <FileText size={17} /> },
  { id: 'assistant', label: 'AI Assistant', to: '/app/assistant', icon: <Bot size={17} /> },
]

function useOutside(ref: React.RefObject<HTMLElement>, on: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) on() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  })
}

function GlobalSearch() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  const an = useAnalysis()
  const { packages, incidents, events } = useStore((s) => ({ packages: s.packages, incidents: s.incidents, events: s.events }))
  const res = useMemo(() => search(q, an, packages, incidents, events), [q, an, packages, incidents, events])
  const rich = res.rich
  const go = (to: string, batchId?: string) => {
    if (batchId) useStore.getState().selectBatch(batchId)
    setOpen(false); setQ(''); navigate(to)
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); (ref.current?.querySelector('input') as HTMLInputElement)?.focus() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search batches, QR IDs, farms, incidents…  ⌘K"
        className="input !rounded-xl !py-2 !pl-9"
      />
      <AnimatePresence>
        {open && q.trim().length >= 2 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-auto rounded-2xl p-2 shadow-2xl">
            {rich && (
              <button onClick={() => go(`/app/batches/${rich.batch.batchId}`, rich.batch.batchId)} className="mb-2 w-full rounded-xl border border-brand/30 bg-brand/[0.06] p-3 text-left hover:bg-brand/10">
                <div className="flex items-center justify-between">
                  <span className="mono text-[13px] font-semibold text-white">{rich.batch.batchId}</span>
                  <StatusBadge status={rich.status} />
                </div>
                <div className="mt-0.5 text-[13px] text-slate-200">{rich.batch.emoji} {rich.batch.product}</div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>Location: <b className="text-slate-200">{rich.currentLocation}</b></span>
                  <span>Authenticity: <b className="text-slate-200">{rich.trust.authenticity.toFixed(1)}%</b></span>
                  <span>Chain: <b className={rich.chain.valid ? 'text-ok' : 'text-bad'}>{rich.chain.valid ? 'VALID' : 'COMPROMISED'}</b></span>
                  <span>Security alerts: <b className={rich.anomalies.length ? 'text-warn' : 'text-ok'}>{rich.anomalies.length}</b></span>
                </div>
              </button>
            )}
            {res.hits.length === 0 && <div className="p-4 text-center text-sm text-slate-400">No results for “{q}”</div>}
            {res.hits.map((h, i) => (
              <button key={i} onClick={() => go(h.to, h.batchId)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/[0.06]">
                <Badge tone="mute" className="w-[68px] justify-center">{h.kind}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-100">{h.title}</span>
                  <span className="block truncate text-xs text-slate-400">{h.sub}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  const notes = useStore((s) => s.notifications)
  const mark = useStore((s) => s.markNotificationsRead)
  const unread = notes.filter((n) => !n.read).length
  const dot = { critical: 'bg-bad', warning: 'bg-warn', success: 'bg-ok', info: 'bg-brand' }
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative rounded-xl border border-line bg-white/[0.03] p-2.5 text-slate-300 hover:bg-white/[0.08]" aria-label="Notifications">
        <Bell size={17} />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass absolute right-0 top-12 z-50 w-[360px] max-w-[90vw] rounded-2xl p-2 shadow-2xl">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm font-semibold text-white">Notifications</span>
              <button className="text-xs text-brand hover:underline" onClick={mark}>Mark all read</button>
            </div>
            <div className="max-h-[360px] overflow-auto">
              {notes.slice(0, 7).map((n) => (
                <button key={n.id} onClick={() => { setOpen(false); n.batchId && useStore.getState().selectBatch(n.batchId); navigate('/app/notifications') }} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/[0.06]">
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dot[n.level], !n.read && 'ring-4 ring-white/5')} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-slate-100">{n.title}</span>
                    <span className="block truncate text-xs text-slate-400">{n.body}</span>
                    <span className="text-[11px] text-slate-500">{fmtAgo(n.ts)}</span>
                  </span>
                </button>
              ))}
            </div>
            <Link to="/app/notifications" className="mt-1 block rounded-lg px-3 py-2 text-center text-xs font-semibold text-brand hover:bg-white/[0.05]" onClick={() => setOpen(false)}>View all notifications</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RoleMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  const role = useStore((s) => s.role)
  const setRole = useStore((s) => s.setRole)
  const def = ROLE_BY_ID[role]
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.03] py-1.5 pl-1.5 pr-3 hover:bg-white/[0.08]">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-ink-950" style={{ background: def.accent }}>{def.short.slice(0, 2).toUpperCase()}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-[12px] font-semibold text-white">{def.actorName ?? def.label}</span>
          <span className="block text-[10.5px] text-slate-400">{def.label}</span>
        </span>
        <ChevronDown size={14} className="text-slate-500" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass absolute right-0 top-12 z-50 w-[300px] rounded-2xl p-2 shadow-2xl">
            <div className="label px-3 py-2">Switch role (demo)</div>
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => { setRole(r.id); setOpen(false); navigate(r.home) }}
                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/[0.06]', r.id === role && 'bg-brand/10')}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.accent }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-slate-100">{r.label}</span>
                  <span className="block truncate text-[11px] text-slate-400">{r.blurb}</span>
                </span>
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <Link to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-slate-300 hover:bg-white/[0.06]"><LogOut size={14} /> Exit to landing page</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BatchPicker() {
  const an = useAnalysis()
  const sel = useStore((s) => s.selectedBatchId)
  const select = useStore((s) => s.selectBatch)
  const cur = an.byId[sel]
  return (
    <div className="hidden items-center gap-2 xl:flex">
      <span className="label">Batch</span>
      <div className="relative">
        <select value={sel} onChange={(e) => select(e.target.value)} className="input !w-[260px] !py-2 mono !text-[12px]">
          {an.list.map((a) => (
            <option key={a.batch.batchId} value={a.batch.batchId}>{a.batch.batchId} · {a.batch.product}</option>
          ))}
        </select>
      </div>
      {cur && <span className={cn('h-2.5 w-2.5 rounded-full', TONE_SOLID[cur.status === 'VERIFIED' ? 'ok' : cur.status === 'IN TRANSIT' ? 'info' : cur.status === 'SUSPICIOUS' || cur.status === 'COLD VIOLATION' || cur.status === 'EXPIRED' ? 'warn' : 'bad'])} title={cur.status} />}
    </div>
  )
}

export function AppLayout({ path, children }: { path: string; children: ReactNode }) {
  const role = useStore((s) => s.role)
  const def = ROLE_BY_ID[role]
  const demoLoaded = useStore((s) => s.demoLoaded)
  const loadDemo = useStore((s) => s.loadDemo)
  const soc = useSocStats()
  const an = useAnalysis()
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [path])
  const nav = NAV.filter((n) => def.nav === 'all' || def.nav.includes(n.id))
  const active = (to: string) => path === to || path.startsWith(to + '/')
  const threats = soc.openCount

  return (
    <div className="flex h-screen overflow-hidden bg-aurora">
      <aside className="no-print flex w-[68px] shrink-0 flex-col border-r border-line bg-ink-900/70 backdrop-blur-xl lg:w-[236px]">
        <Link to="/" className="flex h-16 items-center gap-3 px-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-ok text-ink-950 shadow-[0_0_22px_-4px_rgba(34,211,238,.7)]"><ShieldCheck size={19} strokeWidth={2.4} /></span>
          <span className="hidden leading-tight lg:block">
            <span className="block text-[15px] font-bold tracking-tight text-white">FoodChain Guard</span>
            <span className="block text-[10px] uppercase tracking-[.14em] text-slate-500">Trust every bite</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
          {nav.map((n) => (
            <Link
              key={n.id}
              to={n.to}
              title={n.label}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition',
                active(n.to) ? 'bg-brand/10 text-white' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100',
              )}
            >
              {active(n.to) && <motion.span layoutId="navbar" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand" />}
              <span className={cn(active(n.to) && 'text-brand')}>{n.icon}</span>
              <span className="hidden lg:inline">{n.label}</span>
              {n.id === 'soc' && threats > 0 && <span className="ml-auto hidden rounded-full bg-bad/20 px-1.5 text-[10px] font-bold text-bad lg:inline">{threats}</span>}
            </Link>
          ))}
        </nav>
        <div className="space-y-0.5 border-t border-line px-2.5 py-2">
          <Link to="/app/demo" title="Demo Lab" className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium', active('/app/demo') ? 'bg-vio/15 text-white' : 'text-vio hover:bg-vio/10')}>
            <FlaskConical size={17} /><span className="hidden lg:inline">Demo Lab</span>
          </Link>
          <Link to="/app/settings" title="Settings" className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium', active('/app/settings') ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/[0.05]')}>
            <Settings size={17} /><span className="hidden lg:inline">Settings</span>
          </Link>
          <div className="mx-1 mt-2 hidden rounded-xl border border-line bg-white/[0.02] p-3 lg:block">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-300">
              <span className="relative flex h-2 w-2"><span className="absolute h-full w-full rounded-full bg-ok opacity-60" style={{ animation: 'pulse-ring 1.8s infinite' }} /><span className="relative h-2 w-2 rounded-full bg-ok" /></span>
              OPERATIONAL
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Chain integrity {an.chainIntegrity.toFixed(1)}% · {an.totalBlocks} blocks</div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-16 shrink-0 items-center gap-3 border-b border-line bg-ink-900/50 px-4 backdrop-blur-xl lg:px-6">
          <GlobalSearch />
          <div className="flex-1" />
          <BatchPicker />
          {threats > 0 && (
            <Link to="/app/soc" className="hidden items-center gap-2 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-xs font-semibold text-bad md:flex">
              <Zap size={14} /> {threats} open incident{threats > 1 ? 's' : ''}
            </Link>
          )}
          <NotificationsMenu />
          <RoleMenu />
        </header>
        <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
          {!demoLoaded && (
            <div className="no-print mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-vio/30 bg-vio/10 px-5 py-3 lg:mx-6">
              <div className="flex items-center gap-3 text-[13px] text-slate-200">
                <FlaskConical size={18} className="text-vio" />
                <span><b className="text-white">Baseline data loaded.</b> Load the security demo to populate live incidents: a suspicious package, QR replay, quantity anomaly, cold-chain violation and an unauthorized ledger event.</span>
              </div>
              <Btn variant="primary" onClick={loadDemo} icon={<Zap size={15} />}>LOAD SECURITY DEMO</Btn>
            </div>
          )}
          <motion.div key={path.split('/').slice(0, 3).join('/')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mx-auto w-full max-w-[1560px] p-4 lg:p-6">
            {children}
          </motion.div>
        </main>
      </div>
      <Toasts />
    </div>
  )
}

export { THREAT_LABEL, X, Activity }
