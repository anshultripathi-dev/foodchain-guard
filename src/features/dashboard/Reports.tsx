import { useMemo, useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, Printer, ShieldCheck, ShieldX } from 'lucide-react'
import { Badge, Btn, Card, HashText, Kv, PageHeader, SeverityBadge, StatusBadge, Tabs } from '../../components/ui'
import { useStore } from '../../state/store'
import { useAnalysis, useSelectedAnalysis } from '../../state/selectors'
import { AuthenticityReport } from '../verification/AuthenticityReport'
import { EventTimeline } from '../supply-chain/EventTimeline'
import { recallProfile } from '../../services/recall'
import { TRUST_LABEL, type TrustKey } from '../../services/analysis'
import { THREAT_LABEL } from '../../models/types'
import { sha256 } from '../../utils/sha256'
import { AXIS, GRID, PALETTE, TOOLTIP_STYLE } from '../../components/charts'
import { downloadText, fmtDateTime, fmtTime, fmtNum } from '../../utils/format'
import { NOW } from '../../utils/clock'
import { useQuery } from '../../utils/router'

type Tab = 'trace' | 'auth' | 'incident' | 'cold' | 'recall' | 'audit'

function Frame({ title, subtitle, ok, digestSrc, children }: { title: string; subtitle: string; ok: boolean; digestSrc: unknown; children: ReactNode }) {
  const digest = sha256(JSON.stringify(digestSrc))
  return (
    <Card
      title={title} subtitle={subtitle} glow={ok}
      right={<><Btn size="sm" icon={<Download size={13} />} onClick={() => downloadText(`${title.toLowerCase().replace(/\s+/g, '-')}.json`, JSON.stringify({ title, generatedAt: new Date(NOW).toISOString(), digest, data: digestSrc }, null, 2))}>JSON</Btn><Btn size="sm" icon={<Printer size={13} />} onClick={() => window.print()}>Print</Btn></>}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-3">{ok ? <ShieldCheck className="text-ok" size={22} /> : <ShieldX className="text-bad" size={22} />}<div><div className={`text-sm font-bold ${ok ? 'text-ok' : 'text-bad'}`}>{ok ? 'VERIFICATION PASSED' : 'VERIFICATION ISSUES FOUND'}</div><div className="text-xs text-slate-500">Generated {fmtDateTime(NOW)}</div></div></div>
        <div className="text-right"><div className="label">Report digest (SHA-256)</div><HashText hash={digest} n={12} /></div>
      </div>
      {children}
    </Card>
  )
}

export function Reports() {
  const q = useQuery()
  const [tab, setTab] = useState<Tab>('trace')
  const an = useAnalysis()
  const a = useSelectedAnalysis()
  const select = useStore((s) => s.selectBatch)
  const incidents = useStore((s) => s.incidents)
  const telemetry = useStore((s) => s.telemetry)
  const settings = useStore((s) => s.settings)
  const [incId, setIncId] = useState(incidents[0]?.incidentId)
  void q
  const inc = incidents.find((i) => i.incidentId === incId) ?? incidents[0]
  const prof = useMemo(() => recallProfile(a), [a])

  const qtyData = a.events.map((e) => ({ s: e.action.slice(0, 4), qty: e.quantity }))
  const tel = (telemetry[a.batch.batchId] ?? []).map((p) => ({ t: fmtTime(p.t), temp: p.tempC }))
  const radar = (Object.keys(a.trust.components) as TrustKey[]).map((k) => ({ k: TRUST_LABEL[k], v: a.trust.components[k] }))
  const byType = Object.entries(incidents.reduce<Record<string, number>>((m, i) => { m[THREAT_LABEL[i.type]] = (m[THREAT_LABEL[i.type]] ?? 0) + 1; return m }, {})).map(([name, value]) => ({ name, value }))
  const regionPie = Object.entries(prof.retailers.reduce<Record<string, number>>((m, r) => { m[r.city] = (m[r.city] ?? 0) + r.units; return m }, {})).map(([name, value]) => ({ name, value }))
  const stageIntegrity = useMemo(() => ['HARVESTED', 'PROCESSED', 'DISTRIBUTED', 'STORED', 'RETAILED', 'VERIFIED'].map((stage, i) => { let tot = 0, ok = 0; an.list.forEach((x) => { if (x.events[i]) { tot++; if (x.chain.checks[i].status === 'VALID') ok++ } }); return { stage: stage.slice(0, 5), pct: tot ? +((ok / tot) * 100).toFixed(1) : 100, tot } }), [an])
  const anchor = sha256(an.list.flatMap((x) => x.events.map((e) => e.currentHash)).join(''))

  return (
    <>
      <PageHeader eyebrow="Reports" title="Reports" subtitle="Printable, hash-stamped reports generated from the shared platform state."
        actions={tab !== 'audit' && tab !== 'incident' ? <select className="input mono !w-[290px]" value={a.batch.batchId} onChange={(e) => select(e.target.value)}>{an.list.map((x) => <option key={x.batch.batchId} value={x.batch.batchId}>{x.batch.batchId} · {x.batch.product}</option>)}</select> : undefined} />
      <Tabs<Tab> value={tab} onChange={setTab} items={[
        { id: 'trace', label: 'Batch traceability' }, { id: 'auth', label: 'Authenticity' }, { id: 'incident', label: 'Security incident' },
        { id: 'cold', label: 'Cold chain' }, { id: 'recall', label: 'Recall' }, { id: 'audit', label: 'Supply-chain audit' },
      ]} />

      {tab === 'trace' && (
        <Frame title="Batch traceability report" subtitle={`${a.batch.emoji} ${a.batch.product} · ${a.batch.batchId}`} ok={a.chain.valid && a.anomalies.length === 0} digestSrc={{ batch: a.batch.batchId, hashes: a.events.map((e) => e.currentHash) }}>
          <div className="grid gap-6 xl:grid-cols-2">
            <div><EventTimeline a={a} /></div>
            <div className="space-y-5">
              <div className="h-52"><ResponsiveContainer><BarChart data={qtyData} margin={{ left: -10 }}><CartesianGrid {...GRID} vertical={false} /><XAxis dataKey="s" {...AXIS} /><YAxis {...AXIS} /><Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} /><Bar dataKey="qty" fill="#22d3ee" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
              <div><Kv k="Origin" v={a.batch.origin} /><Kv k="Farm" v={a.batch.farm} /><Kv k="Certification" v={a.batch.certification} /><Kv k="Current owner" v={a.currentOwner} /><Kv k="Hash chain" v={a.chain.valid ? 'VALID' : 'COMPROMISED'} /><Kv k="Status" v={<StatusBadge status={a.status} />} /></div>
            </div>
          </div>
        </Frame>
      )}
      {tab === 'auth' && (
        <div className="space-y-5">
          <AuthenticityReport a={a} />
          <Card title="Trust signal profile"><div className="h-72"><ResponsiveContainer><RadarChart data={radar} outerRadius="72%"><PolarGrid stroke="rgba(148,163,184,.2)" /><PolarAngleAxis dataKey="k" tick={{ fill: '#94a3b8', fontSize: 11 }} /><Radar dataKey="v" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.25} /><Tooltip {...TOOLTIP_STYLE} /></RadarChart></ResponsiveContainer></div></Card>
        </div>
      )}
      {tab === 'incident' && inc && (
        <Frame title="Security incident report" subtitle={`${inc.incidentId} · ${THREAT_LABEL[inc.type]}`} ok={inc.status === 'RESOLVED'} digestSrc={inc}>
          <div className="mb-4"><select className="input mono !w-[360px]" value={inc.incidentId} onChange={(e) => setIncId(e.target.value)}>{incidents.map((i) => <option key={i.incidentId} value={i.incidentId}>{i.incidentId} · {THREAT_LABEL[i.type]} · {i.status}</option>)}</select></div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div><div className="mb-2 flex items-center gap-2"><SeverityBadge s={inc.severity} /><StatusBadge status={inc.status} /></div><p className="mb-3 text-[13px] text-slate-300">{inc.description}</p>
              <Kv k="Batch" v={<span className="mono">{inc.batchId}</span>} /><Kv k="Location" v={inc.location} /><Kv k="Detection" v={inc.detection} /><Kv k="AI confidence" v={`${inc.confidence}%`} />{inc.evidence.map((e) => <Kv key={e.label + e.value} k={e.label} v={e.value} />)}</div>
            <div><div className="label mb-2">Timeline</div><ol className="space-y-3 border-l border-line pl-4">{inc.timeline.map((t, i) => <li key={i}><div className="text-[12.5px] text-slate-100">{t.text}</div><div className="text-[11px] text-slate-500">{fmtDateTime(t.t)}</div></li>)}</ol>
              <div className="mt-4 rounded-xl border border-brand/30 bg-brand/[0.06] p-3 text-[12.5px] text-slate-200"><b>Recommended:</b> {inc.recommended}</div></div>
          </div>
          <div className="mt-6 h-52"><div className="label mb-1">Incidents by type</div><ResponsiveContainer><BarChart data={byType} layout="vertical" margin={{ left: 60 }}><XAxis type="number" {...AXIS} allowDecimals={false} /><YAxis type="category" dataKey="name" {...AXIS} width={140} /><Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} /><Bar dataKey="value" fill="#a78bfa" radius={4} /></BarChart></ResponsiveContainer></div>
        </Frame>
      )}
      {tab === 'cold' && (
        <Frame title="Cold chain report" subtitle={`${a.batch.batchId} · 24-hour telemetry`} ok={!a.cold.violation} digestSrc={{ batch: a.batch.batchId, series: tel }}>
          <div className="h-64"><ResponsiveContainer><LineChart data={tel} margin={{ left: -14 }}><CartesianGrid {...GRID} vertical={false} /><XAxis dataKey="t" {...AXIS} interval={11} /><YAxis {...AXIS} domain={[0, Math.max(12, Math.ceil(a.cold.max + 1))]} /><ReferenceArea y1={settings.minTempC} y2={settings.maxTempC} fill="#34d399" fillOpacity={0.09} /><Tooltip {...TOOLTIP_STYLE} /><Line dataKey="temp" stroke={a.cold.violation ? '#f87171' : '#22d3ee'} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
          <div className="mt-4 grid gap-x-10 md:grid-cols-2"><div><Kv k="Current" v={`${a.cold.current.toFixed(1)}°C`} /><Kv k="Min / max" v={`${a.cold.min.toFixed(1)} / ${a.cold.max.toFixed(1)}°C`} /><Kv k="Mean ± σ" v={`${a.cold.mean.toFixed(1)} ± ${a.cold.stdev.toFixed(2)}°C`} /></div><div><Kv k="Excursions" v={a.cold.runs.length} /><Kv k="Excursion time" v={`${a.cold.excursionMinutes} min`} /><Kv k="Storage score" v={`${a.cold.storageScore}/100`} /></div></div>
        </Frame>
      )}
      {tab === 'recall' && (
        <Frame title="Recall report" subtitle={`${a.batch.batchId} · ${a.batch.product}`} ok={a.batch.hold !== 'RECALLED' ? true : false} digestSrc={{ batch: a.batch.batchId, retailers: prof.retailers.map((r) => [r.id, r.units]) }}>
          <div className="grid gap-6 xl:grid-cols-2">
            <div><div className="mb-3 grid grid-cols-3 gap-3 text-center"><div className="rounded-xl border border-line p-3"><div className="text-2xl font-bold text-bad">{fmtNum(prof.affectedUnits)}</div><div className="text-[11px] text-slate-400">units</div></div><div className="rounded-xl border border-line p-3"><div className="text-2xl font-bold text-warn">{prof.retailers.length}</div><div className="text-[11px] text-slate-400">retailers</div></div><div className="rounded-xl border border-line p-3"><div className="text-2xl font-bold text-brand">{prof.regions.length}</div><div className="text-[11px] text-slate-400">regions</div></div></div>
              <table className="tbl"><thead><tr><th>Retailer</th><th>City</th><th className="text-right">Units</th></tr></thead><tbody>{prof.retailers.slice(0, 10).map((r) => <tr key={r.id}><td>{r.name}</td><td className="text-slate-400">{r.city}</td><td className="text-right tabular-nums">{fmtNum(r.units)}</td></tr>)}</tbody></table></div>
            <div className="h-72"><ResponsiveContainer><PieChart><Pie data={regionPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} stroke="none">{regionPie.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip {...TOOLTIP_STYLE} /></PieChart></ResponsiveContainer></div>
          </div>
          <div className="mt-4"><Badge tone={a.batch.hold === 'RECALLED' ? 'bad' : 'mute'} dot>{a.batch.hold === 'RECALLED' ? 'RECALL IN EFFECT' : 'No recall issued'}</Badge></div>
        </Frame>
      )}
      {tab === 'audit' && (
        <Frame title="Supply-chain audit report" subtitle={`${an.list.length} batches · ${an.totalBlocks} ledger blocks`} ok={an.invalidBlocks === 0} digestSrc={{ anchor, integrity: an.chainIntegrity }}>
          <div className="mb-5 grid gap-4 sm:grid-cols-4">
            {[['Chain integrity', `${an.chainIntegrity.toFixed(1)}%`], ['Blocks verified', `${an.totalBlocks - an.invalidBlocks}/${an.totalBlocks}`], ['Live anomalies', an.anomalies.length], ['Authentic packages', `${an.authenticRate.toFixed(1)}%`]].map(([l, v]) => <div key={l as string} className="rounded-xl border border-line p-4"><div className="text-2xl font-bold text-white">{v}</div><div className="text-xs text-slate-400">{l}</div></div>)}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="h-60"><div className="label mb-1">Block validity by stage (%)</div><ResponsiveContainer><BarChart data={stageIntegrity} margin={{ left: -14 }}><CartesianGrid {...GRID} vertical={false} /><XAxis dataKey="stage" {...AXIS} /><YAxis {...AXIS} domain={[90, 100]} /><Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} /><Bar dataKey="pct" radius={[5, 5, 0, 0]}>{stageIntegrity.map((s, i) => <Cell key={i} fill={s.pct === 100 ? '#34d399' : '#f87171'} />)}</Bar></BarChart></ResponsiveContainer></div>
            <div className="max-h-60 overflow-auto"><table className="tbl"><thead><tr><th>Batch</th><th>Blocks</th><th>Chain</th><th>Signals</th></tr></thead><tbody>{an.list.map((x) => <tr key={x.batch.batchId}><td className="mono text-[12px]">{x.batch.batchId.slice(-5)}</td><td>{x.events.length}</td><td>{x.chain.valid ? <span className="text-ok">VALID</span> : <span className="text-bad">BROKEN</span>}</td><td>{x.anomalies.length || '—'}</td></tr>)}</tbody></table></div>
          </div>
          <div className="mt-4"><div className="label mb-1">Ledger anchor (SHA-256 of all block hashes)</div><HashText hash={anchor} n={20} /></div>
        </Frame>
      )}
    </>
  )
}
