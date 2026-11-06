import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { motion } from 'framer-motion'
import { ArrowRight, Hourglass, ShieldCheck, Skull, TimerReset, CalendarClock } from 'lucide-react'
import { Badge, Bar as UiBar, Btn, Card, PageHeader, ScoreRing, Stat, StatusBadge, Tabs, scoreTone, TONE_HEX, AnimatedNumber } from '../../components/ui'
import { useStore } from '../../state/store'
import { useAnalysis, useSelectedAnalysis } from '../../state/selectors'
import { expiryBucket, expiryLabel, type ExpiryBucket } from '../../services/analysis'
import { AXIS, GRID, TOOLTIP_STYLE } from '../../components/charts'
import { cn, fmtDate } from '../../utils/format'
import { navigate } from '../../utils/router'

const BUCKETS: Array<{ id: ExpiryBucket; label: string; tone: 'bad' | 'warn' | 'ok' | 'info'; icon: React.ReactNode }> = [
  { id: 'TODAY', label: 'Expiring today', tone: 'bad', icon: <TimerReset size={16} /> },
  { id: 'WITHIN_3', label: 'Expiring in 3 days', tone: 'warn', icon: <CalendarClock size={16} /> },
  { id: 'EXPIRED', label: 'Expired', tone: 'bad', icon: <Skull size={16} /> },
  { id: 'SAFE', label: 'Safe', tone: 'ok', icon: <ShieldCheck size={16} /> },
]

function Expiry() {
  const an = useAnalysis()
  const select = useStore((s) => s.selectBatch)
  const [f, setF] = useState<ExpiryBucket | 'ALL'>('ALL')
  const rows = [...an.list].sort((a, b) => a.days - b.days).filter((a) => f === 'ALL' || expiryBucket(a.days) === f)
  const hist = useMemo(() => {
    const bins = ['<0', '0', '1-3', '4-6', '7-10', '11+']
    const cnt = [0, 0, 0, 0, 0, 0]
    an.list.forEach((a) => { const d = a.days; cnt[d < 0 ? 0 : d === 0 ? 1 : d <= 3 ? 2 : d <= 6 ? 3 : d <= 10 ? 4 : 5]++ })
    return bins.map((b, i) => ({ b, n: cnt[i] }))
  }, [an])
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {BUCKETS.map((b) => <Stat key={b.id} label={b.label} value={an.list.filter((a) => expiryBucket(a.days) === b.id).length} tone={b.tone} icon={b.icon} onClick={() => setF(f === b.id ? 'ALL' : b.id)} sub={f === b.id ? 'filtering — click to clear' : 'batches'} />)}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-4">
        <Card className="xl:col-span-3" title="Batches by days remaining" bodyClassName="!px-0 !pb-2">
          <div className="max-h-[470px] overflow-auto">
            <table className="tbl">
              <thead><tr><th>Batch</th><th>Product</th><th>Expiry</th><th className="text-right">Days remaining</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.batch.batchId} className="clickable" onClick={() => { select(a.batch.batchId); navigate(`/app/batches/${a.batch.batchId}`) }}>
                    <td className="mono text-[12px] text-brand">{a.batch.batchId}</td><td>{a.batch.emoji} {a.batch.product}</td><td className="text-slate-300">{fmtDate(a.batch.expiryDate)}</td>
                    <td className={cn('text-right tabular-nums font-semibold', a.days < 0 ? 'text-bad' : a.days <= 4 ? 'text-warn' : 'text-slate-200')}>{a.days}</td>
                    <td><StatusBadge status={expiryLabel(a.days)} /></td>
                    <td className="text-right"><ArrowRight size={14} className="inline text-slate-500" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Distribution">
          <div className="h-60"><ResponsiveContainer><BarChart data={hist} margin={{ left: -26, top: 8 }}><CartesianGrid {...GRID} vertical={false} /><XAxis dataKey="b" {...AXIS} /><YAxis {...AXIS} allowDecimals={false} /><Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} /><Bar dataKey="n" radius={[5, 5, 0, 0]}>{hist.map((h, i) => <Cell key={h.b} fill={i < 2 ? '#f87171' : i === 2 ? '#fbbf24' : '#34d399'} />)}</Bar></BarChart></ResponsiveContainer></div>
          <p className="mt-2 text-xs text-slate-400">Expiry score falls 6 points per day inside the final week (82 at 4 days) and hits 0 at expiry — it directly lowers the food-safety score.</p>
        </Card>
      </div>
    </>
  )
}

function Safety() {
  const a = useSelectedAnalysis()
  const log = useStore((s) => s.safetyLog).filter((e) => e.batchId === a.batch.batchId)
  const items: Array<[string, number, string]> = [
    ['Authenticity', a.scores.authenticity, 'Packaging, QR, watermark, ledger'], ['Chain integrity', a.scores.chainIntegrity, 'Hash-chain verification'],
    ['Storage', a.scores.storage, 'Cold-chain telemetry'], ['Certification', a.scores.certification, a.batch.certification],
    ['Expiry', a.scores.expiry, `${a.days} days remaining`], ['Packaging', a.scores.packaging, 'Fingerprint similarity'],
  ]
  const s = a.scores.foodSafety
  const tone = scoreTone(s)
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card glow title="Food safety score" subtitle={`${a.batch.emoji} ${a.batch.product} · ${a.batch.batchId}`}>
          <div className="flex flex-col items-center py-2">
            <div className="relative">
              <ScoreRing value={s} size={230} stroke={18} label={<span className="text-[56px] font-extrabold"><AnimatedNumber value={s} /></span>} sub="out of 100" />
              <motion.div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 80px -10px ${TONE_HEX[tone]}55` }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 3, repeat: Infinity }} />
            </div>
            <div className="mt-3 text-center"><div className="text-2xl font-extrabold tracking-wide" style={{ color: TONE_HEX[tone] }}>{s} / 100</div>
              <Badge tone={tone} dot>{s >= 85 ? 'SAFE TO CONSUME' : s >= 60 ? 'CAUTION' : 'NOT RECOMMENDED'}</Badge></div>
          </div>
        </Card>
        <div className="space-y-5">
          <Card title="Breakdown" subtitle="Equal-weighted average of six sub-scores">
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {items.map(([l, v, d], i) => (
                <motion.div key={l} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="mb-1.5 flex items-baseline justify-between"><span className="text-[13px] font-medium text-slate-200">{l}</span><span className={cn('text-xl font-bold tabular-nums', v >= 85 ? 'text-ok' : v >= 60 ? 'text-warn' : 'text-bad')}>{v}</span></div>
                  <UiBar value={v} height={7} /><div className="mt-1 text-[11px] text-slate-500">{d}</div>
                </motion.div>
              ))}
            </div>
          </Card>
          <Card title="Score history" subtitle="How attacks and incidents moved this score">
            {log.length === 0 ? <div className="text-sm text-slate-400">No score changes yet. Trigger a scenario from the Demo Lab (e.g. cold-chain violation) to watch this degrade.</div> : (
              <table className="tbl"><thead><tr><th>Event</th><th className="text-right">Food safety</th><th className="text-right">Trust</th></tr></thead>
                <tbody>{log.map((e, i) => <tr key={i}><td className="text-[12.5px] text-slate-200">{e.label}</td><td className="text-right tabular-nums"><span className="text-slate-400">{e.before}</span> → <b className={e.after < e.before ? 'text-bad' : 'text-ok'}>{e.after}</b></td><td className="text-right tabular-nums"><span className="text-slate-400">{e.trustBefore}</span> → <b className={e.trustAfter < e.trustBefore ? 'text-bad' : 'text-ok'}>{e.trustAfter}</b></td></tr>)}</tbody></table>
            )}
            <div className="mt-3 flex gap-2"><Btn size="sm" onClick={() => navigate('/app/cold-chain')}>Cold chain</Btn><Btn size="sm" onClick={() => navigate('/app/demo')}>Demo Lab</Btn></div>
          </Card>
        </div>
      </div>
    </>
  )
}

export function ExpiryAndSafety({ initialTab = 'expiry' }: { initialTab?: 'expiry' | 'safety' }) {
  const [tab, setTab] = useState(initialTab)
  const an = useAnalysis()
  const a = useSelectedAnalysis()
  const select = useStore((s) => s.selectBatch)
  return (
    <>
      <PageHeader eyebrow="Freshness & safety" title="Expiry intelligence & food safety" subtitle="Remaining shelf life, plus one number that blends authenticity, ledger integrity, storage, certification, expiry and packaging."
        actions={tab === 'safety' ? <select className="input mono !w-[290px]" value={a.batch.batchId} onChange={(e) => select(e.target.value)}>{an.list.map((x) => <option key={x.batch.batchId} value={x.batch.batchId}>{x.batch.batchId} · {x.batch.product}</option>)}</select> : undefined} />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'expiry', label: <><Hourglass size={14} />Expiry intelligence</> }, { id: 'safety', label: <><ShieldCheck size={14} />Food safety score</> }]} />
      {tab === 'expiry' ? <Expiry /> : <Safety />}
    </>
  )
}
