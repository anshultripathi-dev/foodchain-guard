import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Ban, MapPin, Megaphone, PackageX, Store, Undo2, Users } from 'lucide-react'
import { Badge, Bar, Btn, Card, Kv, PageHeader, Stat, StatusBadge, TONE_HEX } from '../../components/ui'
import { useStore } from '../../state/store'
import { useAnalysis, useSelectedAnalysis } from '../../state/selectors'
import { recallProfile } from '../../services/recall'
import { cn, fmtNum } from '../../utils/format'
import { navigate } from '../../utils/router'

const KIND_COLOR: Record<string, string> = { batch: '#a78bfa', farm: '#4ade80', processor: '#f59e0b', distributor: '#60a5fa', warehouse: '#38bdf8', retailer: '#34d399' }

export function RecallCenter() {
  const a = useSelectedAnalysis()
  const an = useAnalysis()
  const { select, recalls, start, progress, complete, cancel } = useStore((s) => ({ select: s.selectBatch, recalls: s.recalls, start: s.startRecall, progress: s.recallProgress, complete: s.completeRecall, cancel: s.cancelRecall }))
  const prof = useMemo(() => recallProfile(a), [a])
  const rec = recalls[a.batch.batchId]
  const [reason, setReason] = useState('Suspected counterfeit units and compromised cold chain')
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const notified = new Set(rec?.notified ?? [])
  const secured = prof.retailers.filter((r) => notified.has(r.id)).reduce((x, r) => x + r.units, 0)
  const pct = rec ? (notified.size / prof.order.length) * 100 : 0

  const initiate = () => {
    timers.current.forEach(clearTimeout); timers.current = []
    start(a.batch.batchId, reason)
    prof.order.forEach((id, i) => timers.current.push(window.setTimeout(() => progress(a.batch.batchId, id), 400 + i * (i < prof.chain.length ? 520 : 240))))
    timers.current.push(window.setTimeout(() => complete(a.batch.batchId), 400 + prof.chain.length * 520 + prof.retailers.length * 240 + 300))
  }

  // network layout
  const W = 900, H = 330
  const chainPos = prof.chain.map((c, i) => ({ ...c, x: 70 + i * 120, y: 70 }))
  const retailPos = prof.retailers.map((r, i) => { const cols = Math.min(9, prof.retailers.length); const row = Math.floor(i / cols); const col = i % cols; return { ...r, x: 520 + (col - (cols - 1) / 2) * 0 + col * 42 - (cols * 42) / 2 + 40, y: 180 + row * 70 } })
  const tail = chainPos[chainPos.length - 1]
  const state = (id: string) => (notified.has(id) ? (rec?.status === 'COMPLETE' ? 'done' : 'hot') : 'idle')
  const col = (id: string, kind: string) => (state(id) === 'idle' ? '#475569' : state(id) === 'hot' ? '#f87171' : TONE_HEX.ok) || KIND_COLOR[kind]

  const recommended = an.list.filter((x) => ['SUSPICIOUS', 'COMPROMISED', 'BLOCKED', 'COLD VIOLATION'].includes(x.status)).slice(0, 6)

  return (
    <>
      <PageHeader
        eyebrow="Recall center"
        title="Batch recall management"
        subtitle="Find every unit, retailer and region touched by a batch — then propagate a recall through the supply chain."
        actions={<><StatusBadge status={a.status} /><select className="input mono !w-[290px]" value={a.batch.batchId} onChange={(e) => select(e.target.value)}>{an.list.map((x) => <option key={x.batch.batchId} value={x.batch.batchId}>{x.batch.batchId} · {x.batch.product}</option>)}</select></>}
      />
      {recommended.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2"><span className="label">Candidates</span>{recommended.map((x) => <button key={x.batch.batchId} onClick={() => select(x.batch.batchId)} className={cn('mono rounded-lg border px-3 py-1.5 text-xs', x.batch.batchId === a.batch.batchId ? 'border-bad/50 bg-bad/10 text-bad' : 'border-line text-slate-400 hover:bg-white/5')}>{x.batch.batchId.slice(-5)} · {x.status}</button>)}</div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Affected units" value={fmtNum(prof.affectedUnits)} tone="bad" icon={<PackageX size={16} />} sub={`of ${fmtNum(prof.totalUnits)} produced`} />
        <Stat label="Affected retailers" value={prof.retailers.length} tone="warn" icon={<Store size={16} />} sub="Currently holding stock" />
        <Stat label="Regions" value={<span className="text-[19px]">{prof.regions.join(' · ')}</span>} tone="info" icon={<MapPin size={16} />} sub={`${prof.cities.length} cities`} />
        <Stat label="Recall status" value={<span className="text-[19px]">{rec ? (rec.status === 'COMPLETE' ? 'COMPLETE' : 'IN PROGRESS') : a.batch.hold === 'RECALLED' ? 'RECALLED' : 'NOT RECALLED'}</span>} tone={rec ? 'bad' : 'ok'} icon={<Megaphone size={16} />} sub={rec ? `${secured.toLocaleString('en-US')} units secured` : 'No recall in effect'} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card title="Distribution path & recall propagation" subtitle="Nodes light up as each custodian is notified">
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[760px]" style={{ width: '100%' }}>
              <defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8z" fill="#475569" /></marker></defs>
              {chainPos.slice(1).map((c, i) => <line key={c.id} x1={chainPos[i].x + 22} y1={70} x2={c.x - 22} y2={70} stroke={notified.has(c.id) ? '#f87171' : '#334155'} strokeWidth="2.5" markerEnd="url(#ar)" className={notified.has(c.id) ? 'anim-flow' : ''} />)}
              {retailPos.map((r) => <path key={r.id} d={`M${tail.x},${tail.y + 24} C${tail.x},${150} ${r.x},${120} ${r.x},${r.y - 16}`} fill="none" stroke={notified.has(r.id) ? '#f87171' : '#243049'} strokeWidth={notified.has(r.id) ? 1.8 : 1} className={notified.has(r.id) && rec?.status !== 'COMPLETE' ? 'anim-flow' : ''} />)}
              {chainPos.map((c) => (
                <g key={c.id}>
                  {state(c.id) === 'hot' && <circle cx={c.x} cy={c.y} r="22" fill="none" stroke="#f87171"><animate attributeName="r" from="22" to="42" dur="1.2s" repeatCount="indefinite" /><animate attributeName="opacity" from="0.8" to="0" dur="1.2s" repeatCount="indefinite" /></circle>}
                  <circle cx={c.x} cy={c.y} r="22" fill="#0b1220" stroke={col(c.id, c.kind)} strokeWidth="3" />
                  <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={col(c.id, c.kind)}>{c.kind === 'farm' ? 'FARM' : c.kind === 'processor' ? 'PROC' : c.kind === 'distributor' ? 'DIST' : 'WH'}</text>
                  <text x={c.x} y={c.y + 42} textAnchor="middle" fontSize="10.5" fill="#94a3b8">{c.name.length > 20 ? c.name.slice(0, 19) + '…' : c.name}</text>
                </g>
              ))}
              {retailPos.map((r) => (
                <g key={r.id}>
                  <rect x={r.x - 15} y={r.y - 15} width="30" height="30" rx="8" fill="#0b1220" stroke={col(r.id, 'retailer')} strokeWidth="2.5" />
                  <text x={r.x} y={r.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={col(r.id, 'retailer')}>{r.name.split(' ').slice(-1)[0].slice(0, 3).toUpperCase()}</text>
                  {state(r.id) !== 'idle' && <motion.circle cx={r.x + 13} cy={r.y - 13} r="5" fill={state(r.id) === 'done' ? '#34d399' : '#f87171'} initial={{ scale: 0 }} animate={{ scale: 1 }} />}
                </g>
              ))}
              <text x="520" y="320" textAnchor="middle" fontSize="11" fill="#64748b">{prof.retailers.length} retailers holding units of {a.batch.batchId}</text>
            </svg>
          </div>
          <div className="mt-2"><div className="mb-1 flex justify-between text-xs text-slate-400"><span>Propagation</span><span>{notified.size}/{prof.order.length} custodians notified</span></div><Bar value={pct} tone={rec?.status === 'COMPLETE' ? 'ok' : 'bad'} height={8} /></div>
        </Card>

        <Card title="Recall action" glow={!!rec}>
          <Kv k="Batch" v={<span className="mono">{a.batch.batchId}</span>} /><Kv k="Product" v={`${a.batch.emoji} ${a.batch.product}`} />
          <Kv k="Distribution path" v={prof.chain.map((c) => c.city).join(' → ') + ' → retail'} /><Kv k="Current status" v={<StatusBadge status={a.status} />} />
          <label className="label mb-1 mt-3 block">Reason</label>
          <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} disabled={!!rec} />
          {!rec ? (
            <Btn variant="danger" size="lg" className="mt-4 w-full" icon={<Megaphone size={16} />} onClick={initiate}>Initiate recall</Btn>
          ) : (
            <div className="mt-4 space-y-2">
              <div className={cn('rounded-xl border px-4 py-3 text-sm font-semibold', rec.status === 'COMPLETE' ? 'border-ok/40 bg-ok/10 text-ok' : 'border-bad/40 bg-bad/10 text-bad')}>{rec.status === 'COMPLETE' ? '✓ Recall propagated — all custodians acknowledged' : 'Recall propagating through the network…'}</div>
              <Btn className="w-full" icon={<Undo2 size={14} />} onClick={() => cancel(a.batch.batchId)}>Cancel recall (demo reset)</Btn>
            </div>
          )}
          <Btn className="mt-2 w-full" icon={<Ban size={14} />} onClick={() => navigate('/app/supply-chain')}>Trace batch in 3D</Btn>
        </Card>
      </div>

      <Card className="mt-5" title="Retailer allocation" subtitle="Units currently in the market" icon={<Users size={14} />} bodyClassName="!px-0 !pb-2">
        <div className="max-h-[360px] overflow-auto">
          <table className="tbl"><thead><tr><th>Retailer</th><th>City</th><th className="text-right">Units to recover</th><th>Recall state</th></tr></thead>
            <tbody>{prof.retailers.map((r) => <tr key={r.id}><td className="font-medium text-slate-100">{r.name}</td><td className="text-slate-300">{r.city}</td><td className="text-right tabular-nums">{fmtNum(r.units)}</td><td>{notified.has(r.id) ? <Badge tone={rec?.status === 'COMPLETE' ? 'ok' : 'bad'} dot>{rec?.status === 'COMPLETE' ? 'QUARANTINED' : 'NOTIFIED'}</Badge> : <Badge tone="mute">pending</Badge>}</td></tr>)}</tbody></table>
        </div>
      </Card>
    </>
  )
}
