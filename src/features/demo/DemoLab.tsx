import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, FlaskConical, Play, RotateCcw, Zap } from 'lucide-react'
import { Badge, Btn, Card, Kv, PageHeader, ScoreRing, StatusBadge, TONE_HEX, Tabs } from '../../components/ui'
import { useStore } from '../../state/store'
import { useAnalysis, getAnalysisNow } from '../../state/selectors'
import { SCENARIOS, type ScenarioId } from '../../services/scenarios'
import { navigate } from '../../utils/router'
import { cn, fmtTime } from '../../utils/format'
import { HERO_BATCH } from '../../services/incidents'

const JUMP: Record<ScenarioId, Array<[string, string]>> = {
  authentic: [['Batch details', '/app/batches/{b}'], ['Verification', '/app/verification']],
  counterfeit: [['Heatmap', '/app/packaging/heatmap'], ['AI detection', '/app/packaging/ai']],
  replay: [['QR replay view', '/app/anomalies/replay'], ['Impossible travel', '/app/anomalies/travel']],
  ledger: [['Hash-chain explorer', '/app/blockchain']],
  travel: [['Impossible travel', '/app/anomalies/travel'], ['SOC', '/app/soc']],
  quantity: [['Quantity anomaly', '/app/anomalies/quantity'], ['Ledger', '/app/blockchain']],
  cold: [['Cold chain', '/app/cold-chain'], ['Food safety', '/app/food-safety']],
  expired: [['Expiry dashboard', '/app/expiry'], ['SOC', '/app/soc']],
  cert: [['Digital identity', '/app/identity'], ['Authenticity report', '/app/verification']],
}

interface Snap { trust: number; auth: number; safety: number; status: string; open: number }
const snap = (b: string): Snap => { const a = getAnalysisNow().byId[b]; return { trust: a.trust.trust, auth: a.trust.authenticity, safety: a.scores.foodSafety, status: a.status, open: useStore.getState().incidents.filter((i) => i.status !== 'RESOLVED' && i.status !== 'CONTAINED').length } }

const STEPS: Array<{ t: string; to: string; batch?: boolean; action?: () => void }> = [
  { t: 'Launch FoodChain Guard', to: '/' }, { t: 'Load Security Demo', to: '/app/overview', action: () => useStore.getState().loadDemo() }, { t: 'View Executive Dashboard', to: '/app/overview' },
  { t: 'Open 3D Supply Chain', to: '/app/supply-chain' }, { t: 'Select the demo batch (FCG-2026-00421)', to: '/app/supply-chain', batch: true }, { t: 'Follow the 3D route (“Follow route”)', to: '/app/supply-chain', batch: true },
  { t: 'Open Batch Details', to: `/app/batches/${HERO_BATCH}`, batch: true }, { t: 'View Digital Identity', to: '/app/identity', batch: true }, { t: 'Open Blockchain Explorer', to: '/app/blockchain', batch: true },
  { t: 'Validate the chain', to: '/app/blockchain', batch: true }, { t: 'Open Packaging Verification', to: '/app/packaging', batch: true }, { t: 'Verify an authentic package (Run AI comparison)', to: '/app/packaging', batch: true },
  { t: 'Open the 3D package viewer', to: '/app/packaging/viewer', batch: true }, { t: 'Rotate the package', to: '/app/packaging/viewer', batch: true }, { t: 'Open AI Counterfeit Detection', to: '/app/packaging/ai', batch: true },
  { t: 'Run counterfeit scenario', to: '/app/packaging/ai', batch: true, action: () => useStore.getState().runScenario('counterfeit', HERO_BATCH) }, { t: 'Show the tampering heatmap', to: '/app/packaging/heatmap', batch: true },
  { t: 'Open QR Verification', to: '/app/verification', batch: true }, { t: 'Verify the QR', to: '/app/verification', batch: true }, { t: 'Trigger QR Replay Attack', to: '/app/anomalies/replay', batch: true, action: () => useStore.getState().runScenario('replay', HERO_BATCH) },
  { t: 'Show impossible-travel visualization', to: '/app/anomalies/travel', batch: true }, { t: 'Open Anomaly Center', to: '/app/anomalies', batch: true }, { t: 'Show quantity anomaly', to: '/app/anomalies/quantity', batch: true, action: () => useStore.getState().runScenario('quantity', HERO_BATCH) },
  { t: 'Open Cold Chain', to: '/app/cold-chain', batch: true }, { t: 'Show temperature violation', to: '/app/cold-chain', batch: true, action: () => useStore.getState().runScenario('cold', HERO_BATCH) },
  { t: 'Open Food Safety Score', to: '/app/food-safety', batch: true }, { t: 'Show score degradation', to: '/app/food-safety', batch: true }, { t: 'Open Blockchain Explorer', to: '/app/blockchain', batch: true },
  { t: 'Simulate block tampering', to: '/app/blockchain', batch: true, action: () => useStore.getState().runScenario('ledger', HERO_BATCH) }, { t: 'Show the broken hash chain', to: '/app/blockchain', batch: true }, { t: 'Restore the original block', to: '/app/blockchain', batch: true, action: () => useStore.getState().restoreChain(HERO_BATCH) },
  { t: 'Open Recall Center', to: '/app/recall', batch: true }, { t: 'Trace the affected batch', to: '/app/recall', batch: true }, { t: 'Switch to Consumer mode', to: '/consumer', batch: true, action: () => useStore.getState().setRole('consumer') },
  { t: 'Scan / verify the product', to: '/consumer', batch: true }, { t: 'Consumer-friendly traceability', to: '/consumer', batch: true }, { t: 'Ask the AI Assistant: “Why was this product flagged?”', to: '/app/assistant', batch: true, action: () => { useStore.getState().setRole('admin'); useStore.getState().setAssistantSeed('Why was this product flagged?') } },
  { t: 'Receive an explanation', to: '/app/assistant', batch: true }, { t: 'Return to Executive Dashboard', to: '/app/overview' }, { t: 'Show final security summary', to: '/app/overview' },
]

export function DemoLab() {
  const an = useAnalysis()
  const { selected, select, run, loadDemo, reset, demoLoaded, log, restore, backups } = useStore((s) => ({ selected: s.selectedBatchId, select: s.selectBatch, run: s.runScenario, loadDemo: s.loadDemo, reset: s.resetData, demoLoaded: s.demoLoaded, log: s.scenarioLog, restore: s.restoreChain, backups: s.backups }))
  const a = an.byId[selected] ?? an.list[0]
  const [last, setLast] = useState<{ id: ScenarioId; before: Snap; after: Snap; msg: string; incident?: string } | null>(null)
  const [tab, setTab] = useState<'lab' | 'guide'>('lab')
  const [done, setDone] = useState<Set<number>>(new Set())

  const fire = (id: ScenarioId) => {
    const before = snap(a.batch.batchId)
    const r = run(id, a.batch.batchId)
    setTimeout(() => setLast({ id, before, after: snap(a.batch.batchId), msg: r.message, incident: r.incidentId }), 30)
  }
  const tone = { ok: 'border-ok/30 hover:border-ok/60', bad: 'border-bad/30 hover:border-bad/60', warn: 'border-warn/30 hover:border-warn/60' }
  const dot = { ok: 'bg-ok', bad: 'bg-bad', warn: 'bg-warn' }

  return (
    <>
      <PageHeader
        eyebrow="Demo / attack simulation center"
        title={<span className="flex items-center gap-3"><FlaskConical className="text-vio" size={24} />SECURITY DEMO LAB</span>}
        subtitle="Trigger real attacks against the shared state. Every dashboard — SOC, ledger explorer, food-safety score, batch details, consumer view — responds."
        actions={<><Btn variant="primary" icon={<Zap size={15} />} onClick={loadDemo}>{demoLoaded ? 'Reload security demo' : 'LOAD SECURITY DEMO'}</Btn><Btn icon={<RotateCcw size={14} />} onClick={reset}>Reset to baseline</Btn></>}
      />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'lab', label: 'Attack scenarios' }, { id: 'guide', label: <>Guided 40-step path<Badge tone="vio">{done.size}/{STEPS.length}</Badge></> }]} />

      {tab === 'lab' && (
        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3"><span className="label">Target batch</span>
              <select className="input mono !w-[320px]" value={a.batch.batchId} onChange={(e) => select(e.target.value)}>{an.list.map((x) => <option key={x.batch.batchId} value={x.batch.batchId}>{x.batch.batchId} · {x.batch.product}</option>)}</select>
              {a.batch.batchId !== HERO_BATCH && <Btn size="sm" onClick={() => select(HERO_BATCH)}>Use demo batch</Btn>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {SCENARIOS.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className={cn('glass flex flex-col rounded-2xl border p-4 transition', tone[s.tone])}>
                  <div className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', dot[s.tone])} /><span className="mono text-[11px] text-slate-500">{i + 1}</span><h3 className="text-[14px] font-semibold text-white">{s.title}</h3></div>
                  <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-400">{s.blurb}</p>
                  <div className="mt-2 text-[11px] text-slate-500">Expect: <span className="text-slate-300">{s.expect}</span></div>
                  <Btn size="sm" variant={s.tone === 'ok' ? 'ok' : 'danger'} className="mt-3 w-full" icon={<Play size={13} />} onClick={() => fire(s.id)}>{s.tone === 'ok' ? 'Restore' : 'Trigger'}</Btn>
                </motion.div>
              ))}
            </div>
            {last && (
              <Card className="mt-5" glow title={`Result — ${SCENARIOS.find((x) => x.id === last.id)!.title}`} subtitle={last.msg}>
                <div className="grid gap-4 sm:grid-cols-4">
                  {([['Trust score', last.before.trust, last.after.trust], ['Authenticity %', last.before.auth, last.after.auth], ['Food safety', last.before.safety, last.after.safety], ['Open incidents', last.before.open, last.after.open]] as const).map(([l, b, af]) => (
                    <div key={l} className="rounded-xl border border-line p-3"><div className="label">{l}</div><div className="mt-1 text-lg font-bold tabular-nums text-white">{Number.isInteger(b) ? b : b.toFixed(1)} <ArrowRight size={14} className="inline text-slate-500" /> <span className={af === b ? 'text-slate-300' : (l === 'Open incidents' ? af > b : af < b) ? 'text-bad' : 'text-ok'}>{Number.isInteger(af) ? af : af.toFixed(1)}</span></div></div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs text-slate-400">Status</span><StatusBadge status={last.before.status} /><ArrowRight size={13} className="text-slate-500" /><StatusBadge status={last.after.status} />
                  {last.incident && <Btn size="sm" onClick={() => navigate(`/app/soc/${last.incident}`)}>Incident {last.incident} →</Btn>}
                  {JUMP[last.id].map(([l, to]) => <Btn key={l} size="sm" onClick={() => navigate(to.replace('{b}', a.batch.batchId))}>{l} →</Btn>)}
                </div>
              </Card>
            )}
          </div>
          <div className="space-y-5">
            <Card title="Live state of target batch" glow>
              <div className="flex items-center gap-4"><ScoreRing value={a.trust.trust} size={104} stroke={10} sub="trust" /><div className="space-y-1.5 text-xs"><StatusBadge status={a.status} /><div className="text-slate-400">Authenticity <b className="text-slate-100">{a.trust.authenticity.toFixed(1)}%</b></div><div className="text-slate-400">Food safety <b className="text-slate-100">{a.scores.foodSafety}</b>/100</div></div></div>
              <div className="mt-3"><Kv k="Hash chain" v={a.chain.valid ? <span className="text-ok">VALID</span> : <span className="text-bad">COMPROMISED</span>} /><Kv k="Packaging" v={`${a.packaging.overall.toFixed(0)}% · ${a.classification.label}`} /><Kv k="QR" v={a.qr.status} /><Kv k="Temperature" v={`${a.cold.current.toFixed(1)}°C`} /><Kv k="Security" v={a.trust.security} /></div>
              {backups[a.batch.batchId] && <Btn variant="ok" className="mt-3 w-full" icon={<RotateCcw size={14} />} onClick={() => restore(a.batch.batchId)}>Restore original block</Btn>}
              <div className="mt-3 text-xs text-slate-400">{a.trust.conclusion}</div>
            </Card>
            <Card title="Scenario log" bodyClassName="!pb-3">
              {log.length === 0 ? <div className="text-xs text-slate-500">No scenarios run yet.</div> : <ul className="space-y-2">{log.slice(0, 7).map((l, i) => <li key={i} className="flex gap-2 text-xs"><span className="mono text-slate-500">{fmtTime(l.ts)}</span><span className="text-slate-200">{l.message}</span></li>)}</ul>}
            </Card>
          </div>
        </div>
      )}

      {tab === 'guide' && (
        <Card title="The 40-step evaluation path" subtitle="Click Go to jump to each step (actions are applied automatically where the step is an attack or restore)">
          <ol className="grid gap-2 lg:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={i} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5', done.has(i) ? 'border-ok/30 bg-ok/[0.06]' : 'border-line')}>
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', done.has(i) ? 'bg-ok text-ink-950' : 'bg-white/10 text-slate-300')}>{done.has(i) ? <Check size={13} /> : i + 1}</span>
                <span className="flex-1 text-[13px] text-slate-200">{s.t}</span>
                <Btn size="sm" onClick={() => { if (s.batch) select(HERO_BATCH); s.action?.(); setDone((d) => new Set(d).add(i)); navigate(s.to) }}>Go</Btn>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </>
  )
}
export { TONE_HEX }
