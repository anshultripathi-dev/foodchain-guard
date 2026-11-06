import { useMemo } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Activity, AlertTriangle, ArrowRight, Boxes, CheckCircle2, ShieldAlert, ShieldCheck, Snowflake, Truck, Zap, Package, Layers,
} from 'lucide-react'
import { AnimatedNumber, Badge, Btn, Card, PageHeader, SeverityBadge, Stat, StatusBadge, ScoreRing } from '../../components/ui'
import { IndiaMap } from '../../components/IndiaMap'
import { AXIS, GRID, TOOLTIP_STYLE } from '../../components/charts'
import { useStore } from '../../state/store'
import { useAnalysis } from '../../state/selectors'
import { activitySeries, anomalySeries, authenticitySeries, networkMetrics } from '../../services/metrics'
import { Link, navigate } from '../../utils/router'
import { ROLE_BY_ID } from '../../data/roles'
import { STAGES, THREAT_LABEL } from '../../models/types'
import { fmtAgo, fmtNum } from '../../utils/format'
import { isOpen } from '../../services/incidents'

export function Overview() {
  const an = useAnalysis()
  const { incidents, batches, events, role, demoLoaded, loadDemo } = useStore((s) => ({ incidents: s.incidents, batches: s.batches, events: s.events, role: s.role, demoLoaded: s.demoLoaded, loadDemo: s.loadDemo }))
  const m = useMemo(() => networkMetrics(an, incidents, batches), [an, incidents, batches])
  const def = ROLE_BY_ID[role]
  const activity = useMemo(() => activitySeries(events), [events])
  const trend = useMemo(() => authenticitySeries(m.authenticRate).map((p, i, a) => ({ ...p, integrity: i === a.length - 1 ? +m.chainIntegrity.toFixed(1) : p.integrity })), [m.authenticRate, m.chainIntegrity])
  const anomaly = useMemo(() => anomalySeries(incidents), [incidents])
  const stageCounts = STAGES.map((s) => ({ stage: s, n: an.list.filter((a) => a.stage === s).length }))
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.n))
  const cityCounts = useMemo(() => {
    const c: Record<string, { n: number; bad: number }> = {}
    an.list.forEach((a) => {
      const k = a.currentLocation
      c[k] = c[k] ?? { n: 0, bad: 0 }
      c[k].n++
      if (['SUSPICIOUS', 'BLOCKED', 'COMPROMISED', 'COLD VIOLATION', 'EXPIRED'].includes(a.status)) c[k].bad++
    })
    return c
  }, [an])
  const latest = incidents.slice(0, 6)
  const crit = incidents.filter((i) => isOpen(i) && (i.severity === 'CRITICAL' || i.severity === 'HIGH')).length
  const posture = crit > 3 ? 'ELEVATED' : crit > 0 ? 'GUARDED' : 'NORMAL'
  const c = m.counts

  const summary = [
    { l: 'Chain integrity', v: `${m.chainIntegrity.toFixed(1)}%`, tone: m.chainIntegrity >= 99 ? 'text-ok' : 'text-warn' },
    { l: 'Authentic products', v: `${m.authenticRate.toFixed(1)}%`, tone: m.authenticRate >= 97 ? 'text-ok' : 'text-warn' },
    { l: 'Counterfeit attempts', v: c.COUNTERFEIT_PACKAGING ?? 0, tone: 'text-bad' },
    { l: 'QR replay', v: c.QR_REPLAY ?? 0, tone: 'text-bad' },
    { l: 'Cold chain violations', v: c.COLD_CHAIN_VIOLATION ?? 0, tone: 'text-warn' },
    { l: 'Quantity anomalies', v: c.QUANTITY_ANOMALY ?? 0, tone: 'text-warn' },
    { l: 'Ledger tampering', v: c.LEDGER_TAMPERING ?? 0, tone: 'text-bad' },
    { l: 'Open incidents', v: m.openIncidents, tone: m.openIncidents ? 'text-warn' : 'text-ok' },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Executive dashboard"
        title="Security & supply-chain command center"
        subtitle="One view of three truths — the physical package, its digital identity and its supply-chain history — and whether they still agree."
        actions={
          <>
            {!demoLoaded && <Btn variant="primary" icon={<Zap size={15} />} onClick={loadDemo}>Load Security Demo</Btn>}
            <Btn onClick={() => navigate('/app/supply-chain')} icon={<Boxes size={15} />}>Open 3D Supply Chain</Btn>
            <Btn onClick={() => navigate('/app/demo')} icon={<ShieldAlert size={15} />}>Attack Lab</Btn>
          </>
        }
      />

      {role !== 'admin' && role !== 'analyst' && (
        <Card className="mb-5" glow>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="label" style={{ color: def.accent }}>{def.label} workspace</div>
              <div className="mt-1 text-[15px] font-semibold text-white">{def.actorName}</div>
              <div className="text-xs text-slate-400">{def.blurb}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {def.tasks.map((t) => <Btn key={t.to} size="sm" onClick={() => navigate(t.to)} icon={<ArrowRight size={13} />}>{t.label}</Btn>)}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total batches" value={<AnimatedNumber value={m.totalBatches} />} sub="Network-wide, incl. 30-batch live sample" icon={<Layers size={16} />} onClick={() => navigate('/app/batches')} />
        <Stat label="Active shipments" value={m.activeShipments} sub="In transit between actors" tone="info" icon={<Truck size={16} />} onClick={() => navigate('/app/supply-chain')} />
        <Stat label="Verified products" value={<AnimatedNumber value={m.verifiedProducts} />} sub={`${m.authenticRate.toFixed(1)}% classified authentic`} tone="ok" icon={<CheckCircle2 size={16} />} />
        <Stat label="Suspicious products" value={<AnimatedNumber value={m.suspiciousProducts} />} sub="Units in flagged / blocked batches" tone={m.suspiciousProducts ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
        <Stat label="Counterfeit alerts" value={m.counterfeitAlerts} sub="Packaging mismatch signals" tone={m.counterfeitAlerts ? 'bad' : 'ok'} icon={<ShieldAlert size={16} />} onClick={() => navigate('/app/packaging')} />
        <Stat label="Chain integrity" value={<AnimatedNumber value={m.chainIntegrity} decimals={1} suffix="%" />} sub={`${an.totalBlocks - an.invalidBlocks}/${an.totalBlocks} blocks verified`} tone={m.chainIntegrity >= 99 ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} onClick={() => navigate('/app/blockchain')} />
        <Stat label="Cold-chain violations" value={m.coldViolations} sub="Batches out of 2–8 °C" tone={m.coldViolations ? 'warn' : 'ok'} icon={<Snowflake size={16} />} onClick={() => navigate('/app/cold-chain')} />
        <Stat label="Open incidents" value={m.openIncidents} sub={`${m.activeThreats} active threats`} tone={m.openIncidents ? 'bad' : 'ok'} icon={<Activity size={16} />} onClick={() => navigate('/app/soc')} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="FoodChain Guard — security status"
          subtitle="Final security summary (live from the shared ledger, scan history and incident store)"
          right={
            <div className="flex items-center gap-2 rounded-full border border-ok/30 bg-ok/10 px-3 py-1 text-[11px] font-bold tracking-wider text-ok">
              <span className="relative flex h-2 w-2"><span className="absolute h-full w-full rounded-full bg-ok" style={{ animation: 'pulse-ring 1.6s infinite' }} /><span className="relative h-2 w-2 rounded-full bg-ok" /></span>
              SYSTEM STATUS · OPERATIONAL
            </div>
          }
        >
          <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-2">
              <ScoreRing value={m.chainIntegrity} size={150} stroke={12} label={`${m.chainIntegrity.toFixed(1)}%`} sub="Chain integrity" />
              <Badge tone={posture === 'NORMAL' ? 'ok' : posture === 'GUARDED' ? 'warn' : 'bad'}>Threat posture · {posture}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {summary.map((s) => (
                <div key={s.l} className="rounded-xl border border-line bg-white/[0.02] p-3">
                  <div className={`text-2xl font-bold tabular-nums ${s.tone}`}>{s.v}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Supply chain overview" subtitle="Where the 30 live batches currently sit">
          <div className="space-y-3">
            {stageCounts.map((s, i) => (
              <div key={s.stage}>
                <div className="mb-1 flex justify-between text-xs"><span className="text-slate-300">{i + 1}. {s.stage}</span><span className="mono text-slate-400">{s.n} batches</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-brand to-ok" style={{ width: `${(s.n / maxStage) * 100}%`, transition: 'width .8s' }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Batch activity" subtitle="Ledger events per day">
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={activity} margin={{ left: -22, right: 4, top: 8 }}>
                <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity={0.5} /><stop offset="1" stopColor="#22d3ee" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="day" {...AXIS} interval={2} /><YAxis {...AXIS} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="events" stroke="#22d3ee" strokeWidth={2} fill="url(#ga)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Authenticity trend" subtitle="% of packages classified authentic · chain integrity">
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ left: -18, right: 4, top: 8 }}>
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="day" {...AXIS} interval={2} /><YAxis {...AXIS} domain={[94, 100]} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="authentic" name="Authentic %" stroke="#34d399" strokeWidth={2.2} dot={false} />
                <Line type="monotone" dataKey="integrity" name="Chain integrity %" stroke="#a78bfa" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Anomaly trend" subtitle="Incidents per day by severity">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={anomaly} margin={{ left: -22, right: 4, top: 8 }}>
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="day" {...AXIS} interval={2} /><YAxis {...AXIS} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <Bar dataKey="LOW" stackId="a" fill="#60a5fa" /><Bar dataKey="MEDIUM" stackId="a" fill="#fbbf24" /><Bar dataKey="HIGH" stackId="a" fill="#fb923c" /><Bar dataKey="CRITICAL" stackId="a" fill="#f87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-2" title="Geographic distribution" subtitle="Current batch locations · red = needs attention">
          <IndiaMap
            height={340}
            zoom="west"
            markers={Object.entries(cityCounts).map(([city, v]) => ({ city, label: city, sub: `${v.n} batch${v.n > 1 ? 'es' : ''}`, tone: v.bad ? 'bad' : 'ok', r: 5 + Math.min(9, v.n * 1.6), pulse: v.bad > 0 }))}
          />
        </Card>
        <Card className="xl:col-span-3" title="Latest incidents" right={<Link to="/app/soc" className="text-xs font-semibold text-brand hover:underline">Open SOC →</Link>} bodyClassName="!px-0 !pb-2">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Incident</th><th>Type</th><th>Batch</th><th>Severity</th><th>Status</th><th>When</th></tr></thead>
              <tbody>
                {latest.map((i) => (
                  <tr key={i.incidentId} className="clickable" onClick={() => navigate(`/app/soc/${i.incidentId}`)}>
                    <td className="mono text-[12px] text-brand">{i.incidentId}</td>
                    <td>{THREAT_LABEL[i.type]}</td>
                    <td className="mono text-[12px] text-slate-300">{i.batchId.slice(-5)}</td>
                    <td><SeverityBadge s={i.severity} /></td>
                    <td><StatusBadge status={i.status} /></td>
                    <td className="text-xs text-slate-400">{fmtAgo(i.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mt-5" title="Recent batches" right={<Link to="/app/batches" className="text-xs font-semibold text-brand hover:underline">All batches →</Link>} bodyClassName="!px-0 !pb-2">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Batch</th><th>Product</th><th>Location</th><th>Stage</th><th>Authenticity</th><th>Chain</th><th>Status</th></tr></thead>
            <tbody>
              {an.list.slice(0, 6).map((a) => (
                <tr key={a.batch.batchId} className="clickable" onClick={() => { useStore.getState().selectBatch(a.batch.batchId); navigate(`/app/batches/${a.batch.batchId}`) }}>
                  <td className="mono text-[12px] text-brand">{a.batch.batchId}</td>
                  <td>{a.batch.emoji} {a.batch.product}</td>
                  <td className="text-slate-300">{a.currentLocation}</td>
                  <td className="text-xs text-slate-400">{a.stage}</td>
                  <td className="tabular-nums">{a.trust.authenticity.toFixed(1)}%</td>
                  <td>{a.chain.valid ? <span className="text-ok">VALID</span> : <span className="text-bad">COMPROMISED</span>}</td>
                  <td><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

export { Package, fmtNum }
