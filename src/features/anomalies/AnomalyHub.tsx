import { Fragment, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts'
import { AlertTriangle, ArrowRight, Clock, Copy, Gauge, Layers, MapPin, Plane, ShieldAlert } from 'lucide-react'
import { motion } from 'framer-motion'
import { Badge, Btn, Card, Kv, PageHeader, SeverityBadge, Stat, Tabs, StatusBadge } from '../../components/ui'
import { IndiaMap } from '../../components/IndiaMap'
import { AXIS, GRID, TOOLTIP_STYLE } from '../../components/charts'
import { useStore } from '../../state/store'
import { useAnalysis, useSelectedAnalysis } from '../../state/selectors'
import { THREAT_LABEL, type ThreatType } from '../../models/types'
import { roadKm, AVG_ROAD_SPEED_KMH } from '../../utils/geo'
import { cn, fmtDateTime, fmtTime } from '../../utils/format'
import { navigate } from '../../utils/router'
import { DEMO_TARGETS } from '../../data/seed'

type Tab = 'overview' | 'replay' | 'travel' | 'quantity'

const RULES: Array<[ThreatType, string]> = [
  ['QR_REPLAY', '≥3 cities in 6h, or an impossible hop for one QR'], ['IMPOSSIBLE_TRAVEL', 'Implied speed above plausible road speed'],
  ['QUANTITY_ANOMALY', 'Hand-off quantity drops >2% or increases'], ['UNEXPECTED_LOCATION', 'Scan outside declared route region'],
  ['COLD_CHAIN_VIOLATION', 'Sensor outside 2–8°C for ≥2 samples'], ['EXPIRED_PRODUCT', 'Past expiry while in retail chain'],
  ['REPEATED_SCAN', '≥6 scans of one QR within 60 minutes'], ['UNAUTHORIZED_EVENT', 'Block signed by unregistered actor'], ['LEDGER_TAMPERING', 'Hash, link or signature mismatch'],
]

function Overview() {
  const an = useAnalysis()
  const select = useStore((s) => s.selectBatch)
  const [type, setType] = useState<'ALL' | ThreatType>('ALL')
  const [open, setOpen] = useState<string | null>(null)
  const list = an.anomalies.filter((x) => type === 'ALL' || x.type === type).sort((a, b) => ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(b.severity) - ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(a.severity))
  const types = [...new Set(an.anomalies.map((a) => a.type))]
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Live anomalies" value={an.anomalies.length} tone={an.anomalies.length ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} sub="Detected by the engine right now" />
        <Stat label="Critical / high" value={an.anomalies.filter((a) => a.severity === 'HIGH' || a.severity === 'CRITICAL').length} tone="bad" icon={<ShieldAlert size={16} />} sub="Needs analyst attention" />
        <Stat label="Batches affected" value={new Set(an.anomalies.map((a) => a.batchId)).size} tone="info" icon={<Layers size={16} />} sub={`of ${an.list.length} live batches`} />
        <Stat label="Avg. confidence" value={`${an.anomalies.length ? Math.round(an.anomalies.reduce((a, x) => a + x.confidence, 0) / an.anomalies.length) : 0}%`} tone="vio" icon={<Gauge size={16} />} sub="Models are never 100% certain" />
      </div>
      <div className="grid gap-5 xl:grid-cols-4">
        <Card className="xl:col-span-3" title="Anomaly engine output" subtitle="Each finding has type, severity, confidence, evidence and a recommended action" right={
          <select className="input !w-auto !py-1.5 text-xs" value={type} onChange={(e) => setType(e.target.value as 'ALL' | ThreatType)}><option value="ALL">All types</option>{types.map((t) => <option key={t} value={t}>{THREAT_LABEL[t]}</option>)}</select>
        } bodyClassName="!px-0 !pb-2">
          <div className="max-h-[560px] overflow-auto">
            <table className="tbl">
              <thead><tr><th>Type</th><th>Severity</th><th>Confidence</th><th>Batch</th><th>Finding</th><th /></tr></thead>
              <tbody>
                {list.map((x) => (
                  <Fragment key={x.id}>
                    <tr className="clickable" onClick={() => setOpen(open === x.id ? null : x.id)}>
                      <td className="font-medium text-slate-100">{THREAT_LABEL[x.type]}</td><td><SeverityBadge s={x.severity} /></td>
                      <td className="tabular-nums">{x.confidence}%</td><td className="mono text-[12px] text-brand">{x.batchId.slice(-5)}</td><td className="text-[12.5px] text-slate-300">{x.title}</td>
                      <td className="text-right"><ArrowRight size={14} className={cn('inline text-slate-500 transition', open === x.id && 'rotate-90')} /></td>
                    </tr>
                    {open === x.id && (
                      <tr><td colSpan={6} className="bg-white/[0.02]">
                        <div className="grid gap-4 py-1 md:grid-cols-2">
                          <div><div className="label mb-1">Evidence</div><ul className="list-disc space-y-0.5 pl-4 text-[12.5px] text-slate-300">{x.evidence.map((e) => <li key={e}>{e}</li>)}</ul></div>
                          <div><div className="label mb-1">Recommended action</div><div className="text-[12.5px] text-slate-200">{x.recommended}</div>
                            <div className="mt-2 flex gap-2"><Btn size="sm" onClick={() => { select(x.batchId); navigate(`/app/batches/${x.batchId}`) }}>Open batch</Btn><Btn size="sm" onClick={() => navigate('/app/soc')}>Open SOC</Btn></div></div>
                        </div>
                      </td></tr>
                    )}
                  </Fragment>
                ))}
                {list.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-400">No anomalies — all batches behave as expected.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Detection rules" subtitle="Deterministic rules + mock ML scoring">
          <ul className="space-y-2.5">
            {RULES.map(([t, d]) => (
              <li key={t} className="text-xs"><div className="flex items-center justify-between"><span className="font-semibold text-slate-200">{THREAT_LABEL[t]}</span><Badge tone={an.anomalies.some((a) => a.type === t) ? 'warn' : 'mute'}>{an.anomalies.filter((a) => a.type === t).length}</Badge></div><div className="text-slate-500">{d}</div></li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

function Replay() {
  const an = useAnalysis()
  const a = useSelectedAnalysis()
  const run = useStore((s) => s.runScenario)
  const select = useStore((s) => s.selectBatch)
  const replayBatches = an.list.filter((x) => x.qr.replay)
  const cur = a.qr.replay ? a : replayBatches[0] ?? a
  const q = cur.qr
  const risk = q.replay ? (q.cities.length >= 4 ? 'CRITICAL' : 'HIGH') : 'LOW'
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="label">QR replay incidents</span>
        {replayBatches.length === 0 && <span className="text-xs text-slate-500">none detected — trigger one →</span>}
        {replayBatches.map((x) => <button key={x.batch.batchId} onClick={() => select(x.batch.batchId)} className={cn('mono rounded-lg border px-3 py-1.5 text-xs', x.batch.batchId === cur.batch.batchId ? 'border-bad/50 bg-bad/10 text-bad' : 'border-line text-slate-400')}>{x.qr.qrId}</button>)}
        <Btn size="sm" variant="danger" className="ml-auto" icon={<Copy size={13} />} onClick={() => run('replay', a.batch.batchId)}>Trigger QR replay on {a.batch.batchId.slice(-5)}</Btn>
      </div>
      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3" title={<span className="mono">{q.qrId}</span>} subtitle={`${cur.batch.product} · ${cur.batch.batchId}`} right={q.replay ? <Badge tone="bad" dot pulse>QR REPLAY ATTACK</Badge> : <Badge tone="ok" dot>consistent</Badge>}>
          <IndiaMap height={400} zoom="all" markers={q.cities.map((c, i) => ({ city: c, label: `${c}`, tone: q.replay ? (i === 0 ? 'ok' : 'bad') : 'ok', r: 7, pulse: q.replay && i > 0 }))} routes={q.scans.slice(1).map((s, i) => ({ from: q.scans[i].city, to: s.city, tone: q.replay ? 'bad' : 'info' }))} />
        </Card>
        <div className="space-y-5 xl:col-span-2">
          <Card title="Scan sequence">
            <ol className="space-y-2">
              {q.scans.map((s, i) => (
                <motion.li key={s.scanId} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-[13px]">
                  <span className="mono flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[11px]">{i + 1}</span>
                  <span className="font-semibold text-slate-100"><MapPin size={12} className="mr-1 inline text-slate-500" />{s.city}</span><span className="ml-auto text-xs text-slate-400">{fmtDateTime(s.timestamp)}</span>
                </motion.li>
              ))}
              {q.scans.length === 0 && <div className="text-sm text-slate-400">No scans.</div>}
            </ol>
          </Card>
          <Card title="Assessment" glow={q.replay}>
            <div className={cn('rounded-xl border px-4 py-3 text-sm', q.replay ? 'border-bad/40 bg-bad/10 text-bad' : 'border-ok/30 bg-ok/10 text-ok')}>{q.replay ? 'Same package identity observed across inconsistent locations.' : 'Scan locations are consistent with the declared route.'}</div>
            <div className="mt-3"><Kv k="Detected" v={q.replay ? 'QR REPLAY ATTACK' : 'no replay'} /><Kv k="Risk" v={<Badge tone={risk === 'LOW' ? 'ok' : 'bad'}>{risk}</Badge>} /><Kv k="Distinct cities" v={q.cities.length} /><Kv k="Impossible hops" v={q.impossible.length} /></div>
            {q.replay && <p className="mt-3 text-xs text-slate-400">A copied QR still resolves to a real ledger record — which is why the physical packaging fingerprint is checked too. Recommended: block batch, revoke this QR, re-verify physical units.</p>}
          </Card>
        </div>
      </div>
    </>
  )
}

function Travel() {
  const an = useAnalysis()
  const a = useSelectedAnalysis()
  const run = useStore((s) => s.runScenario)
  const select = useStore((s) => s.selectBatch)
  const withTravel = an.list.filter((x) => x.qr.impossible.length)
  const cur = a.qr.impossible.length ? a : withTravel[0] ?? a
  const t = cur.qr.impossible[0]
  const km = t?.km ?? roadKm('Mumbai', 'Delhi')
  const mins = t?.minutes ?? 47
  const expected = t?.expectedMinutes ?? Math.round((km / AVG_ROAD_SPEED_KMH) * 60)
  const from = t?.from.city ?? 'Mumbai', to = t?.to.city ?? 'Delhi'
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="label">Batches with impossible travel</span>
        {withTravel.map((x) => <button key={x.batch.batchId} onClick={() => select(x.batch.batchId)} className={cn('mono rounded-lg border px-3 py-1.5 text-xs', x.batch.batchId === cur.batch.batchId ? 'border-bad/50 bg-bad/10 text-bad' : 'border-line text-slate-400')}>{x.batch.batchId.slice(-5)}</button>)}
        <Btn size="sm" variant="danger" className="ml-auto" icon={<Plane size={13} />} onClick={() => run('travel', a.batch.batchId)}>Trigger impossible travel</Btn>
      </div>
      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Geo-velocity check" subtitle="Can the same package be in both places?" right={t ? <Badge tone="bad" dot pulse>IMPOSSIBLE TRAVEL</Badge> : <Badge tone="mute">illustrative</Badge>}>
          <IndiaMap height={380} zoom="all" markers={[{ city: from, tone: 'ok', r: 8 }, { city: to, tone: t ? 'bad' : 'warn', r: 8, pulse: !!t }]} routes={[{ from, to, tone: t ? 'bad' : 'warn' }]} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-4"><div className="label">Previous scan</div><div className="mt-1 text-lg font-bold text-white">{from}</div><div className="mono text-sm text-slate-400">{t ? fmtTime(t.from.timestamp) : '10:15 AM'}</div></div>
            <div className="rounded-xl border border-bad/40 bg-bad/[0.07] p-4"><div className="label">Next scan</div><div className="mt-1 text-lg font-bold text-white">{to}</div><div className="mono text-sm text-slate-400">{t ? fmtTime(t.to.timestamp) : '11:02 AM'}</div></div>
          </div>
        </Card>
        <Card className="xl:col-span-2" title="Physics" subtitle="Distance ÷ time vs plausible road speed" glow={!!t}>
          <div className="space-y-3 text-[13px]">
            <Kv k="Distance" v={<b>{km.toLocaleString('en-US')} km</b>} />
            <Kv k="Elapsed" v={<b className="text-bad">{mins} minutes</b>} />
            <Kv k="Expected travel" v={<b>~{Math.round(expected / 60)} hours</b>} />
            <Kv k="Implied speed" v={<b className="text-bad">{Math.round(km / (mins / 60)).toLocaleString('en-US')} km/h</b>} />
          </div>
          <div className="mt-4 h-24">
            <ResponsiveContainer>
              <BarChart data={[{ n: 'Elapsed', m: mins }, { n: 'Expected', m: expected }]} layout="vertical" margin={{ left: 10, right: 40 }}>
                <XAxis type="number" hide /><YAxis type="category" dataKey="n" {...AXIS} width={64} />
                <Bar dataKey="m" radius={4}>{[0, 1].map((i) => <Cell key={i} fill={i === 0 ? '#f87171' : '#34d399'} />)}<LabelList dataKey="m" position="right" fill="#e2e8f0" fontSize={11} formatter={(v: number) => (v > 120 ? `${Math.round(v / 60)} h` : `${v} min`)} /></Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className={cn('mt-3 rounded-xl border px-4 py-3 text-sm font-semibold', 'border-bad/40 bg-bad/10 text-bad')}>IMPOSSIBLE TRAVEL — possible QR duplication / identity cloning.</div>
        </Card>
      </div>
    </>
  )
}

function Quantity() {
  const an = useAnalysis()
  const a = useSelectedAnalysis()
  const run = useStore((s) => s.runScenario)
  const select = useStore((s) => s.selectBatch)
  const withQty = an.list.filter((x) => x.qty.some((s) => s.kind !== 'OK'))
  const cur = a.qty.some((s) => s.kind !== 'OK') ? a : withQty[0] ?? a
  const data = cur.events.map((e, i) => ({ stage: e.action.slice(0, 1) + e.action.slice(1).toLowerCase(), who: e.actor, qty: e.quantity, bad: cur.qty[i - 1]?.kind !== undefined && cur.qty[i - 1]?.kind !== 'OK' }))
  const step = cur.qty.find((s) => s.kind !== 'OK')
  const unit = cur.batch.unit
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="label">Batches with quantity anomalies</span>
        {withQty.map((x) => <button key={x.batch.batchId} onClick={() => select(x.batch.batchId)} className={cn('mono rounded-lg border px-3 py-1.5 text-xs', x.batch.batchId === cur.batch.batchId ? 'border-warn/50 bg-warn/10 text-warn' : 'border-line text-slate-400')}>{x.batch.batchId.slice(-5)}</button>)}
        {withQty.length === 0 && <span className="text-xs text-slate-500">none — trigger one →</span>}
        <Btn size="sm" variant="danger" className="ml-auto" onClick={() => run('quantity', a.batch.batchId)}>Manipulate quantity (−300) on {a.batch.batchId.slice(-5)}</Btn>
      </div>
      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Quantity along the chain" subtitle={`${cur.batch.emoji} ${cur.batch.product} · ${cur.batch.batchId}`} right={step ? <Badge tone="warn" dot pulse>QUANTITY ANOMALY</Badge> : <Badge tone="ok" dot>consistent</Badge>}>
          <div className="h-[340px]">
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 24, left: -8, right: 8 }}>
                <CartesianGrid {...GRID} vertical={false} /><XAxis dataKey="stage" {...AXIS} /><YAxis {...AXIS} />
                <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} formatter={(v: number) => [`${v.toLocaleString('en-US')} ${unit}`, 'Quantity']} labelFormatter={(_, p) => (p?.[0]?.payload?.who as string) ?? ''} />
                {step && <ReferenceLine y={step.from.quantity} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: 'upstream', fill: '#fbbf24', fontSize: 11, position: 'insideTopRight' }} />}
                <Bar dataKey="qty" radius={[6, 6, 0, 0]}>{data.map((d, i) => <Cell key={i} fill={d.bad ? '#f87171' : '#22d3ee'} />)}<LabelList dataKey="qty" position="top" fill="#e2e8f0" fontSize={12} formatter={(v: number) => v.toLocaleString('en-US')} /></Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <div className="space-y-5 xl:col-span-2">
          <Card title="Reconciliation" glow={!!step}>
            {cur.qty.map((s) => (
              <div key={s.to.eventId} className={cn('flex items-center justify-between border-b border-white/5 py-2 text-[13px] last:border-0', s.kind !== 'OK' && 'text-warn')}>
                <span className="text-slate-300">{s.from.action} → {s.to.action}</span>
                <span className="mono">{s.kind === 'OK' ? `${s.missing > 0 ? '−' + s.missing : '0'} (${s.pct.toFixed(1)}%)` : `${s.kind === 'LOSS' ? '−' : '+'}${Math.abs(s.missing)} (${s.pct.toFixed(1)}%)`}</span>
              </div>
            ))}
            {step ? (
              <div className="mt-4 rounded-xl border border-warn/40 bg-warn/10 p-4">
                <div className="text-2xl font-extrabold text-warn">{Math.abs(cur.unaccounted || step.missing).toLocaleString('en-US')} {unit} unaccounted for</div>
                <div className="mt-1 text-xs text-slate-300">between {step.from.actor} and {step.to.actor}</div>
                <Btn size="sm" className="mt-3" icon={<ArrowRight size={13} />} onClick={() => { select(cur.batch.batchId); navigate(`/app/blockchain?block=${step.to.index + 1}`) }}>Open the chain event ({step.to.eventId})</Btn>
              </div>
            ) : <div className="mt-4 rounded-xl border border-ok/30 bg-ok/10 p-3 text-sm text-ok">Quantities reconcile within the 2% tolerance.</div>}
          </Card>
          <Card title="Why this matters"><p className="text-xs leading-relaxed text-slate-400">Missing units can mean theft, diversion into grey markets — or mixing in unregistered product. Each hand-off is signed, so a custodian cannot silently under-report: the upstream figure is already on the ledger.</p></Card>
        </div>
      </div>
    </>
  )
}

export function AnomalyHub({ initialTab = 'overview' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const an = useAnalysis()
  const a = useSelectedAnalysis()
  const select = useStore((s) => s.selectBatch)
  return (
    <>
      <PageHeader
        eyebrow="Anomaly center"
        title="Anomaly detection"
        subtitle="Rules and mock-ML models watch scans, quantities, sensors and the ledger. Every finding carries confidence, evidence and a recommended action."
        actions={<><StatusBadge status={a.status} /><select className="input mono !w-[290px]" value={a.batch.batchId} onChange={(e) => select(e.target.value)}>{an.list.map((x) => <option key={x.batch.batchId} value={x.batch.batchId}>{x.batch.batchId} · {x.batch.product}</option>)}</select></>}
      />
      <Tabs value={tab} onChange={setTab} items={[
        { id: 'overview', label: <><AlertTriangle size={14} />Overview</>, badge: <Badge tone="warn">{an.anomalies.length}</Badge> },
        { id: 'replay', label: <><Copy size={14} />QR replay</> },
        { id: 'travel', label: <><Plane size={14} />Impossible travel</> },
        { id: 'quantity', label: <><Layers size={14} />Quantity anomaly</> },
      ]} />
      {tab === 'overview' && <Overview />}
      {tab === 'replay' && <Replay />}
      {tab === 'travel' && <Travel />}
      {tab === 'quantity' && <Quantity />}
    </>
  )
}
export { Clock, DEMO_TARGETS }
