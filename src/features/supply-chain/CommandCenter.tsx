import { lazy, Suspense, useMemo, useState } from 'react'
import { Boxes, Crosshair, Map as MapIcon, Play, RotateCcw, Route } from 'lucide-react'
import { Badge, Btn, Card, Kv, PageHeader, ScoreRing, StatusBadge, Tabs, Bar, scoreTone, TONE_HEX, type Tone } from '../../components/ui'
import type { NodeKey, NodeStatus } from '../../components/3d/nodes'
import { NODE_KEYS } from '../../components/3d/SupplyChainScene'
import { useStore } from '../../state/store'
import { useAnalysis, useSelectedAnalysis } from '../../state/selectors'
import type { BatchAnalysis } from '../../services/analysis'
import { ACTOR_BY_ID } from '../../data/catalog'
import { EventTimeline } from './EventTimeline'
import { IndiaMap } from '../../components/IndiaMap'
import { fmtDate, fmtDateTime } from '../../utils/format'
import { navigate } from '../../utils/router'
import { cn } from '../../utils/format'
import { STAGES, type Stage } from '../../models/types'

const Scene = lazy(() => import('../../components/3d/SupplyChainScene').then((m) => ({ default: m.SupplyChainScene })))

const NODE_STAGE: Record<NodeKey, Stage> = { farm: 'HARVESTED', processing: 'PROCESSED', distribution: 'DISTRIBUTED', warehouse: 'STORED', retail: 'RETAILED', consumer: 'VERIFIED' }
export const NODE_TITLE: Record<NodeKey, string> = { farm: 'Farm', processing: 'Processing plant', distribution: 'Distribution hub', warehouse: 'Cold warehouse', retail: 'Retail', consumer: 'Consumer' }

export function nodeNames(a: BatchAnalysis): Record<NodeKey, string> {
  const r = a.batch.route
  const pick = (i: number, fallback: string) => a.events[i]?.actor ?? fallback
  return {
    farm: a.batch.farm,
    processing: pick(1, ACTOR_BY_ID[r.processorId].name),
    distribution: pick(2, ACTOR_BY_ID[r.distributorId].name),
    warehouse: pick(3, ACTOR_BY_ID[r.warehouseId].name),
    retail: pick(4, ACTOR_BY_ID[r.retailerId].name),
    consumer: 'Consumer',
  }
}

export function nodeStatuses(a: BatchAnalysis): Record<NodeKey, NodeStatus> {
  const out = {} as Record<NodeKey, NodeStatus>
  NODE_KEYS.forEach((k, i) => {
    const stage = NODE_STAGE[k]
    const list = a.anomalies.filter((x) => x.stage === stage)
    const chainBad = a.chain.checks[i] && a.chain.checks[i].status !== 'VALID'
    out[k] = chainBad || list.some((x) => x.severity === 'HIGH' || x.severity === 'CRITICAL') ? 'bad' : list.length ? 'warn' : 'ok'
  })
  return out
}

function NodeDetail({ k, a }: { k: NodeKey; a: BatchAnalysis }) {
  const idx = NODE_KEYS.indexOf(k)
  const ev = a.events[idx]
  const an = useAnalysis()
  const stage = NODE_STAGE[k]
  const alerts = a.anomalies.filter((x) => x.stage === stage)
  const scans = a.qr.scans.length
  const b = a.batch
  const same = (fn: (x: BatchAnalysis) => boolean) => an.list.filter(fn).length
  const status = nodeStatuses(a)[k]
  let rows: Array<[string, React.ReactNode]> = []
  if (k === 'farm') rows = [
    ['Batches (this farm)', same((x) => x.batch.farmId === b.farmId)], ['Harvest', fmtDate(b.harvestDate)], ['Certification', `${b.certification} · ${b.certValid ? 'valid' : 'FAILED'}`],
    ['Quantity', `${(a.events[0]?.quantity ?? b.quantity).toLocaleString('en-US')} ${b.unit}`], ['Origin', b.origin],
  ]
  if (k === 'processing') rows = [
    ['Batches processed', same((x) => x.batch.route.processorId === b.route.processorId)], ['Processing date', fmtDate(b.processingDate)],
    ['Packaging fingerprint', <span className="mono">{b.packagingFingerprint}</span>], ['Watermark ID', <span className="mono">{b.watermarkId}</span>], ['Quantity out', ev ? `${ev.quantity.toLocaleString('en-US')} ${b.unit}` : '—'],
  ]
  if (k === 'distribution') rows = [
    ['Shipments (this hub)', same((x) => x.batch.route.distributorId === b.route.distributorId)], ['Dispatched', ev ? fmtDateTime(ev.timestamp) : '—'],
    ['Quantity shipped', ev ? `${ev.quantity.toLocaleString('en-US')} ${b.unit}` : '—'], ['Hub', ACTOR_BY_ID[b.route.distributorId].city],
  ]
  if (k === 'warehouse') rows = [
    ['Storage', 'Cold room · 2–8 °C'], ['Temperature', <span className={a.cold.violation ? 'text-bad' : 'text-ok'}>{a.cold.current.toFixed(1)} °C</span>], ['Humidity', `${a.cold.humidity}%`],
    ['Inventory', ev ? `${ev.quantity.toLocaleString('en-US')} ${b.unit}` : '—'], ['Alerts', alerts.length ? <span className="text-warn">{alerts.length} active</span> : <span className="text-ok">none</span>],
  ]
  if (k === 'retail') rows = [
    ['Retailer', ACTOR_BY_ID[b.route.retailerId].name], ['Shelf stock', ev ? `${ev.quantity.toLocaleString('en-US')} ${b.unit}` : '—'], ['QR scans', scans], ['Packaging', `${a.packaging.overall.toFixed(0)}% · ${a.classification.label}`],
  ]
  if (k === 'consumer') rows = [
    ['Verification scans', scans], ['Trust score', `${a.trust.trust}/100`], ['Verdict', a.trust.verdict],
  ]
  return (
    <Card
      glow
      title={<>{NODE_TITLE[k]} · {nodeNames(a)[k]}</>}
      right={<Badge tone={status === 'ok' ? 'ok' : status === 'warn' ? 'warn' : 'bad'} dot>{status === 'ok' ? 'VERIFIED' : status === 'warn' ? 'WARNING' : 'ANOMALY'}</Badge>}
    >
      {idx >= a.events.length ? <div className="text-sm text-slate-400">This batch has not reached this node yet.</div> : (
        <>
          {rows.map(([l, v]) => <Kv key={l} k={l} v={v} />)}
          {alerts.map((x) => <div key={x.id} className="mt-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">⚠ {x.title}</div>)}
        </>
      )}
    </Card>
  )
}

function SupplyMap({ a }: { a: BatchAnalysis }) {
  const cities = a.events.map((e) => e.location)
  const statuses = nodeStatuses(a)
  const tone = (i: number): Tone => (statuses[NODE_KEYS[i]] === 'ok' ? 'ok' : statuses[NODE_KEYS[i]] === 'warn' ? 'warn' : 'bad')
  const seen = new Set<string>()
  const markers = a.events.map((e, i) => ({ city: e.location, label: seen.has(e.location) ? undefined : `${i + 1}. ${e.location}`, sub: seen.has(e.location) ? undefined : e.actor, tone: tone(i), r: 7, pulse: i === a.events.length - 1 && !seen.add(e.location) }))
  const routes = cities.slice(0, -1).map((c, i) => ({ from: c, to: cities[i + 1], tone: 'info' as Tone, animated: true }))
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <Card className="xl:col-span-3" title="Route map" subtitle={`${a.batch.batchId} · ${a.batch.product}`}>
        <IndiaMap markers={markers} routes={routes} zoom="west" height={470} />
      </Card>
      <Card className="xl:col-span-2" title="Movement history">
        <table className="tbl">
          <thead><tr><th>#</th><th>Stage</th><th>From → to</th><th>Time</th></tr></thead>
          <tbody>
            {a.events.map((e, i) => (
              <tr key={e.eventId}>
                <td className="mono text-slate-500">{i + 1}</td><td>{e.action}</td>
                <td className="text-xs">{i === 0 ? e.location : `${a.events[i - 1].location} → ${e.location}`}</td>
                <td className="text-xs text-slate-400">{fmtDateTime(e.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

export function CommandCenter({ initialTab = '3d' }: { initialTab?: '3d' | 'map' | 'timeline' }) {
  const a = useSelectedAnalysis()
  const an = useAnalysis()
  const select = useStore((s) => s.selectBatch)
  const [tab, setTab] = useState<'3d' | 'map' | 'timeline'>(initialTab)
  const [node, setNode] = useState<NodeKey | null>(null)
  const [follow, setFollow] = useState<{ id: number; upTo: number } | null>(null)
  const [arrived, setArrived] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const names = useMemo(() => nodeNames(a), [a])
  const statuses = useMemo(() => nodeStatuses(a), [a])
  const reached = a.events.length

  const startFollow = () => {
    setNode(null); setArrived(0); setRunning(true)
    setFollow({ id: Date.now(), upTo: Math.max(1, reached - 1) })
  }

  return (
    <>
      <PageHeader
        eyebrow="Digital twin"
        title="3D supply chain command center"
        subtitle="Select a batch, then follow its cryptographically-recorded journey from farm to consumer. Click any facility for live status."
        actions={<Btn variant="primary" onClick={() => navigate('/app/batches/' + a.batch.batchId)}>Open batch details</Btn>}
      />
      <Tabs
        value={tab} onChange={setTab}
        items={[{ id: '3d', label: <><Boxes size={14} />3D command center</> }, { id: 'map', label: <><MapIcon size={14} />Supply chain map</> }, { id: 'timeline', label: <><Route size={14} />Timeline</> }]}
      />

      {tab === '3d' && (
        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="glass relative overflow-hidden rounded-2xl" style={{ height: 'min(72vh, 700px)', minHeight: 460 }}>
            <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-400">Loading 3D world…</div>}>
              <Scene
                names={names} statuses={statuses} reached={reached} selected={node}
                onSelect={(k) => { setNode(k); if (k) setArrived(NODE_KEYS.indexOf(k)) }}
                follow={follow} onArrive={(i) => setArrived(i)} onFollowDone={() => setRunning(false)}
              />
            </Suspense>
            <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-3">
              <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-line bg-ink-900/80 p-2 backdrop-blur">
                <select className="input mono !w-[250px] !py-1.5 !text-xs" value={a.batch.batchId} onChange={(e) => { select(e.target.value); setNode(null); setArrived(null) }}>
                  {an.list.map((x) => <option key={x.batch.batchId} value={x.batch.batchId}>{x.batch.batchId} · {x.batch.product}</option>)}
                </select>
                <Btn size="sm" variant="primary" icon={<Play size={13} />} onClick={startFollow} disabled={running}>{running ? 'Following…' : 'Follow route'}</Btn>
                <Btn size="sm" icon={<RotateCcw size={13} />} onClick={() => { setNode(null); setArrived(null) }}>Reset view</Btn>
              </div>
              <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-line bg-ink-900/80 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
                {([['ok', 'Verified'], ['warn', 'Warning'], ['bad', 'Anomaly']] as const).map(([t, l]) => (
                  <span key={t} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE_HEX[t] }} />{l}</span>
                ))}
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-500" />Not reached</span>
              </div>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-ink-900/70 px-3 py-1.5 text-[11px] text-slate-400 backdrop-blur">
              <Crosshair size={12} className="mr-1.5 inline" />Orbit · scroll to zoom · right-drag to pan · click a facility
            </div>
          </div>

          <div className="space-y-4">
            <Card title={<span className="mono">{a.batch.batchId}</span>} subtitle={`${a.batch.emoji} ${a.batch.product}`} right={<StatusBadge status={a.status} />}>
              <div className="flex items-center gap-4">
                <ScoreRing value={a.trust.trust} size={92} stroke={9} sub="trust" />
                <div className="flex-1 space-y-2.5 text-xs">
                  {([['Authenticity', a.scores.authenticity], ['Chain integrity', a.scores.chainIntegrity], ['Food safety', a.scores.foodSafety]] as const).map(([l, v]) => (
                    <div key={l}><div className="mb-1 flex justify-between text-slate-400"><span>{l}</span><span className="text-slate-200">{v}</span></div><Bar value={v} tone={scoreTone(v)} /></div>
                  ))}
                </div>
              </div>
            </Card>
            {node ? <NodeDetail k={node} a={a} /> : (
              <Card title="Journey events" subtitle={arrived !== null && running ? 'Shipment in motion…' : 'Click a facility or follow the route'}>
                <div className="space-y-1.5">
                  {STAGES.map((s, i) => {
                    const ev = a.events[i]
                    const st = statuses[NODE_KEYS[i]]
                    return (
                      <button
                        key={s} disabled={!ev} onClick={() => setNode(NODE_KEYS[i])}
                        className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-[12.5px] transition', arrived === i ? 'border-brand/60 bg-brand/10' : 'border-line hover:bg-white/[0.04]', !ev && 'opacity-40')}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: ev ? TONE_HEX[st === 'ok' ? 'ok' : st === 'warn' ? 'warn' : 'bad'] : '#475569' }} />
                        <span className="font-semibold text-slate-100">{s}</span>
                        <span className="ml-auto truncate text-slate-400">{ev ? ev.location : 'pending'}</span>
                      </button>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
      {tab === 'map' && (
        <>
          <div className="mb-4 flex items-center gap-2">
            <select className="input mono !w-[300px]" value={a.batch.batchId} onChange={(e) => select(e.target.value)}>
              {an.list.map((x) => <option key={x.batch.batchId} value={x.batch.batchId}>{x.batch.batchId} · {x.batch.product}</option>)}
            </select>
            <StatusBadge status={a.status} />
          </div>
          <SupplyMap a={a} />
        </>
      )}
      {tab === 'timeline' && (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <select className="input mono !w-[300px]" value={a.batch.batchId} onChange={(e) => select(e.target.value)}>
                {an.list.map((x) => <option key={x.batch.batchId} value={x.batch.batchId}>{x.batch.batchId} · {x.batch.product}</option>)}
              </select>
            </div>
            <EventTimeline a={a} />
          </div>
          <Card title="Why this matters" subtitle="Every hand-off is a signed block">
            <p className="text-[13px] leading-relaxed text-slate-300">Each stage is recorded by its custodian, signed with their key, and chained to the previous block with SHA-256. Editing history changes a hash and invalidates every block after it.</p>
            <div className="mt-4 space-y-1">
              <Kv k="Blocks" v={a.events.length} /><Kv k="Chain" v={a.chain.valid ? <span className="text-ok">VALID</span> : <span className="text-bad">COMPROMISED</span>} />
              <Kv k="Quantity check" v={a.unaccounted ? <span className="text-warn">{a.unaccounted} {a.batch.unit} unaccounted</span> : <span className="text-ok">consistent</span>} />
            </div>
            <Btn className="mt-4 w-full" onClick={() => navigate('/app/blockchain')}>Open blockchain explorer</Btn>
          </Card>
        </div>
      )}
    </>
  )
}
