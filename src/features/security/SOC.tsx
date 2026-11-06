import { useEffect, useMemo, useRef, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, AlertTriangle, Ban, Clock, Copy, FileWarning, Hammer, Layers, Plane, ShieldAlert, Skull, Snowflake, UserX } from 'lucide-react'
import { Badge, Card, PageHeader, SeverityBadge, Stat, StatusBadge, sevTone, type Tone } from '../../components/ui'
import { useStore } from '../../state/store'
import { useAnalysis, useSocStats } from '../../state/selectors'
import { THREAT_LABEL, type ThreatType } from '../../models/types'
import { navigate } from '../../utils/router'
import { cn, fmtAgo, fmtTime } from '../../utils/format'
import { NOW } from '../../utils/clock'
import { makeRng } from '../../utils/prng'
import { TOOLTIP_STYLE } from '../../components/charts'
import { isOpen } from '../../services/incidents'
import { IndiaMap } from '../../components/IndiaMap'

const METRICS: Array<{ type: ThreatType; label: string; icon: React.ReactNode; tone: Tone }> = [
  { type: 'COUNTERFEIT_PACKAGING', label: 'Counterfeit attempts', icon: <Ban size={16} />, tone: 'bad' },
  { type: 'QR_REPLAY', label: 'QR replay', icon: <Copy size={16} />, tone: 'bad' },
  { type: 'LEDGER_TAMPERING', label: 'Ledger tampering', icon: <Hammer size={16} />, tone: 'bad' },
  { type: 'QUANTITY_ANOMALY', label: 'Quantity anomalies', icon: <Layers size={16} />, tone: 'warn' },
  { type: 'COLD_CHAIN_VIOLATION', label: 'Cold-chain violations', icon: <Snowflake size={16} />, tone: 'warn' },
  { type: 'IMPOSSIBLE_TRAVEL', label: 'Impossible travel', icon: <Plane size={16} />, tone: 'bad' },
  { type: 'EXPIRED_PRODUCT', label: 'Expired product', icon: <Skull size={16} />, tone: 'warn' },
  { type: 'UNAUTHORIZED_EVENT', label: 'Unauthorized events', icon: <UserX size={16} />, tone: 'bad' },
]

interface StreamItem { id: number; ts: number; level: 'INFO' | 'OK' | 'WARN' | 'CRIT'; text: string; incident?: string }
let seq = 1

export function SOC() {
  const incidents = useStore((s) => s.incidents)
  const audit = useStore((s) => s.audit)
  const an = useAnalysis()
  const soc = useSocStats()
  const [sev, setSev] = useState<string>('ALL')
  const [st, setSt] = useState<string>('ACTIVE')
  const [stream, setStream] = useState<StreamItem[]>(() =>
    [...audit.slice(0, 5).map((a) => ({ id: seq++, ts: a.ts, level: (a.status === 'VALID' ? 'OK' : 'WARN') as StreamItem['level'], text: `${a.actor} · ${a.action} · ${a.batchId}` })), ...incidents.slice(0, 6).reverse().map((i) => ({ id: seq++, ts: i.timestamp, level: (i.severity === 'CRITICAL' || i.severity === 'HIGH' ? 'CRIT' : 'WARN') as StreamItem['level'], text: `${i.incidentId} ${THREAT_LABEL[i.type]} · ${i.batchId}`, incident: i.incidentId }))].sort((a, b) => a.ts - b.ts),
  )
  const lastInc = useRef(incidents[0]?.incidentId)
  const tick = useRef(0)

  useEffect(() => {
    const r = makeRng('soc-stream')
    const id = setInterval(() => {
      tick.current++
      const a = an.list[Math.floor(r.next() * an.list.length)]
      const city = ['Mumbai', 'Pune', 'Nashik', 'Thane'][Math.floor(r.next() * 4)]
      const kinds = [
        { level: 'OK' as const, text: `Scan verified ${a.worstPackage.qrId} · ${city} · PASS` },
        { level: 'INFO' as const, text: `Ledger sweep ${a.batch.batchId} · ${a.events.length - a.chain.invalidCount}/${a.events.length} blocks valid` },
        { level: 'INFO' as const, text: `Sensor heartbeat TH-${a.batch.batchId.slice(-3)} · ${a.cold.current.toFixed(1)}°C` },
        { level: 'OK' as const, text: `Packaging check ${a.worstPackage.packageId} · ${a.packaging.overall.toFixed(0)}%` },
      ]
      const k = kinds[tick.current % kinds.length]
      setStream((s) => [...s.slice(-59), { id: seq++, ts: NOW + tick.current * 2500, ...k }])
    }, 2400)
    return () => clearInterval(id)
  }, [an])

  useEffect(() => {
    const top = incidents[0]
    if (top && top.incidentId !== lastInc.current) {
      lastInc.current = top.incidentId
      setStream((s) => [...s.slice(-59), { id: seq++, ts: NOW, level: top.severity === 'CRITICAL' || top.severity === 'HIGH' ? 'CRIT' : 'WARN', text: `${top.incidentId} ${THREAT_LABEL[top.type]} · ${top.batchId} · ${top.severity}`, incident: top.incidentId }])
    }
  }, [incidents])

  const rows = incidents.filter((i) => (sev === 'ALL' || i.severity === sev) && (st === 'ALL' ? true : st === 'ACTIVE' ? i.status !== 'RESOLVED' : i.status === st))
  const pie = (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((k) => ({ name: k, value: soc.bySeverity[k] }))
  const PIE_COLOR = { LOW: '#60a5fa', MEDIUM: '#fbbf24', HIGH: '#fb923c', CRITICAL: '#f87171' }
  const posture = soc.bySeverity.CRITICAL > 0 ? 'CRITICAL' : soc.bySeverity.HIGH > 1 ? 'ELEVATED' : soc.openCount ? 'GUARDED' : 'NORMAL'
  const markers = useMemo(() => {
    const m: Record<string, number> = {}
    incidents.filter(isOpen).forEach((i) => { const c = an.byId[i.batchId]?.currentLocation; if (c) m[c] = (m[c] ?? 0) + 1 })
    return Object.entries(m).map(([city, n]) => ({ city, label: city, sub: `${n} open`, tone: 'bad' as Tone, r: 6 + n * 2, pulse: true }))
  }, [incidents, an])
  const lvl = { INFO: 'text-slate-400', OK: 'text-ok', WARN: 'text-warn', CRIT: 'text-bad' }

  return (
    <>
      <PageHeader
        eyebrow="Security operations center"
        title="Threat monitoring"
        subtitle="Incidents raised by the anomaly engine and attack simulations. Every action here is mirrored on batch, dashboard and audit screens."
        actions={<><Badge tone={posture === 'NORMAL' ? 'ok' : posture === 'GUARDED' ? 'warn' : 'bad'} dot pulse>Threat posture · {posture}</Badge><Badge tone="info">{soc.openCount} open</Badge></>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {METRICS.map((m) => {
          const total = soc.counts[m.type] ?? 0
          const open = incidents.filter((i) => i.type === m.type && isOpen(i)).length
          return <Stat key={m.type} label={m.label} value={total} tone={open ? m.tone : 'mute'} icon={m.icon} sub={open ? <span className="text-warn">{open} open</span> : 'all closed'} />
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Live event stream" subtitle="Scans, sweeps, sensors and alerts" className="xl:col-span-2" right={<Badge tone="ok" dot pulse>LIVE</Badge>} bodyClassName="!pb-3">
          <div className="mono h-[300px] overflow-y-auto rounded-xl bg-ink-950/70 p-3 text-[12px]">
            <AnimatePresence initial={false}>
              {[...stream].reverse().map((e) => (
                <motion.div key={e.id} layout initial={{ opacity: 0, y: -8, backgroundColor: e.level === 'CRIT' ? 'rgba(248,113,113,.25)' : 'rgba(34,211,238,.1)' }} animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(0,0,0,0)' }} transition={{ duration: 1.2 }} className="flex gap-3 rounded px-1.5 py-[3px]">
                  <span className="text-slate-600">{fmtTime(e.ts)}</span>
                  <span className={cn('w-10 shrink-0 font-bold', lvl[e.level])}>{e.level}</span>
                  {e.incident ? <button className="text-left text-slate-200 hover:text-brand hover:underline" onClick={() => navigate(`/app/soc/${e.incident}`)}>{e.text}</button> : <span className="text-slate-300">{e.text}</span>}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Card>
        <div className="space-y-5">
          <Card title="Open incidents by severity">
            <div className="flex items-center gap-4">
              <div className="h-36 w-36"><ResponsiveContainer><PieChart><Pie data={pie.some((p) => p.value) ? pie : [{ name: 'none', value: 1 }]} dataKey="value" innerRadius={42} outerRadius={64} paddingAngle={3} stroke="none">{(pie.some((p) => p.value) ? pie : [{ name: 'none', value: 1 }]).map((p) => <Cell key={p.name} fill={(PIE_COLOR as Record<string, string>)[p.name] ?? '#334155'} />)}</Pie><Tooltip {...TOOLTIP_STYLE} /></PieChart></ResponsiveContainer></div>
              <ul className="flex-1 space-y-1.5 text-xs">{pie.map((p) => <li key={p.name} className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ background: (PIE_COLOR as Record<string, string>)[p.name] }} />{p.name}</span><b className="text-slate-100">{p.value}</b></li>)}</ul>
            </div>
          </Card>
          <Card title="Threat locations"><IndiaMap height={190} zoom="west" markers={markers} /></Card>
        </div>
      </div>

      <Card className="mt-5" title="Incident queue" icon={<ShieldAlert size={14} className="text-bad" />} right={
        <div className="flex gap-2">
          <select className="input !w-auto !py-1.5 text-xs" value={sev} onChange={(e) => setSev(e.target.value)}>{['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((x) => <option key={x}>{x}</option>)}</select>
          <select className="input !w-auto !py-1.5 text-xs" value={st} onChange={(e) => setSt(e.target.value)}>{['ACTIVE', 'ALL', 'OPEN', 'INVESTIGATING', 'ESCALATED', 'CONTAINED', 'RESOLVED'].map((x) => <option key={x}>{x}</option>)}</select>
        </div>
      } bodyClassName="!px-0 !pb-2">
        <div className="max-h-[440px] overflow-auto">
          <table className="tbl">
            <thead><tr><th>Incident</th><th>Type</th><th>Severity</th><th>Batch</th><th>Location</th><th>Detection</th><th>Conf.</th><th>Status</th><th>Raised</th></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.incidentId} className="clickable" onClick={() => navigate(`/app/soc/${i.incidentId}`)}>
                  <td className="mono text-[12px] font-semibold text-brand">{i.incidentId}</td><td className="font-medium text-slate-100">{THREAT_LABEL[i.type]}</td>
                  <td><SeverityBadge s={i.severity} /></td><td className="mono text-[12px]">{i.batchId.slice(-5)}</td><td className="max-w-[180px] truncate text-slate-300">{i.location}</td>
                  <td className="max-w-[170px] truncate text-xs text-slate-400">{i.detection}</td><td className="tabular-nums">{i.confidence}%</td><td><StatusBadge status={i.status} /></td><td className="whitespace-nowrap text-xs text-slate-400">{fmtAgo(i.timestamp)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-slate-400">No incidents match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
export { Activity, AlertTriangle, Clock, FileWarning, sevTone }
