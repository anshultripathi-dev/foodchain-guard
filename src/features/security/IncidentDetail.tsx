import { ArrowUpRight, Ban, CheckCheck, Clock, Eye, Fingerprint, MapPin, ScanLine, Undo2 } from 'lucide-react'
import { Badge, Btn, Card, Kv, PageHeader, SeverityBadge, StatusBadge } from '../../components/ui'
import { IndiaMap } from '../../components/IndiaMap'
import { useStore } from '../../state/store'
import { useAnalysis } from '../../state/selectors'
import { THREAT_LABEL } from '../../models/types'
import { Link, navigate } from '../../utils/router'
import { fmtDateTime, fmtTime, cn } from '../../utils/format'
import { CITIES } from '../../utils/geo'

export function IncidentDetail({ id }: { id: string }) {
  const inc = useStore((s) => s.incidents.find((i) => i.incidentId === id))
  const act = useStore((s) => s.incidentAction)
  const select = useStore((s) => s.selectBatch)
  const an = useAnalysis()
  if (!inc) return <Card title="Incident not found"><Link to="/app/soc" className="text-brand">← Back to SOC</Link></Card>
  const a = an.byId[inc.batchId]
  const q = inc.qrId && a ? a.qr : null
  const first = q?.scans[0], last = q?.scans[q.scans.length - 1]
  const blocked = a?.batch.hold === 'BLOCKED'
  const sevBar = { LOW: 'border-brand/40', MEDIUM: 'border-warn/40', HIGH: 'border-bad/50', CRITICAL: 'border-bad' }[inc.severity]
  const done = inc.status === 'RESOLVED'
  return (
    <>
      <PageHeader
        eyebrow={<Link to="/app/soc" className="hover:underline">← Security operations</Link> as unknown as string}
        title={<span className="flex flex-wrap items-center gap-3">INCIDENT <span className="mono text-brand">#{inc.incidentId}</span><SeverityBadge s={inc.severity} /><StatusBadge status={inc.status} /></span>}
        subtitle={inc.description}
        actions={
          <>
            <Btn variant="ok" icon={<CheckCheck size={15} />} onClick={() => act(id, 'resolve')} disabled={done}>Mark resolved</Btn>
            <Btn icon={<ArrowUpRight size={15} />} onClick={() => act(id, 'escalate')} disabled={done || inc.status === 'ESCALATED'}>Escalate</Btn>
            {blocked ? <Btn icon={<Undo2 size={15} />} onClick={() => act(id, 'unblock')}>Unblock batch</Btn> : <Btn variant="danger" icon={<Ban size={15} />} onClick={() => act(id, 'block')} disabled={!a}>Block batch</Btn>}
          </>
        }
      />
      <div className={cn('mb-5 grid gap-4 rounded-2xl border-l-4 bg-white/[0.03] p-5 md:grid-cols-4', sevBar)}>
        <div><div className="label">Type</div><div className="mt-1 text-[15px] font-bold text-white">{THREAT_LABEL[inc.type]}</div></div>
        <div><div className="label">Batch</div><button className="mono mt-1 text-[14px] font-semibold text-brand hover:underline" onClick={() => { select(inc.batchId); navigate(`/app/batches/${inc.batchId}`) }}>{inc.batchId}</button>{blocked && <Badge tone="bad" className="ml-2">BLOCKED</Badge>}</div>
        <div><div className="label">Detection</div><div className="mt-1 text-[13px] text-slate-100">{inc.detection}</div><div className="text-xs text-slate-500">AI confidence {inc.confidence}%</div></div>
        <div><div className="label">Raised</div><div className="mt-1 text-[13px] text-slate-100">{fmtDateTime(inc.timestamp)}</div></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <div className="space-y-5 xl:col-span-3">
          <Card title="Evidence" icon={<Eye size={14} className="text-brand" />}>
            {inc.evidence.map((e) => <Kv key={e.label + e.value} k={e.label} v={e.value} />)}
            {q && first && last && (
              <>
                <div className="mt-4 label">First → latest location</div>
                <div className="mt-1 flex items-center gap-3 text-[15px] font-semibold text-white"><MapPin size={15} className="text-ok" />{first.city}<span className="text-slate-500">→</span><MapPin size={15} className="text-bad" />{last.city}</div>
              </>
            )}
          </Card>
          {q && q.scans.length > 0 && (
            <Card title="QR & location history" subtitle={q.qrId}>
              <div className="grid gap-5 md:grid-cols-2">
                <IndiaMap height={250} zoom="all" markers={q.cities.filter((c) => CITIES[c]).map((c, i) => ({ city: c, tone: i === 0 ? 'ok' : 'bad', r: 6, pulse: i > 0 && q.replay }))} routes={q.scans.slice(1).map((s, i) => ({ from: q.scans[i].city, to: s.city, tone: 'bad' }))} />
                <table className="tbl"><thead><tr><th>#</th><th>City</th><th>Time</th></tr></thead><tbody>{q.scans.map((s, i) => <tr key={s.scanId}><td className="mono text-slate-500">{i + 1}</td><td>{s.city}</td><td className="text-xs text-slate-300">{fmtTime(s.timestamp)}</td></tr>)}</tbody></table>
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-5 xl:col-span-2">
          <Card title="Recommended action" glow><p className="text-[13px] leading-relaxed text-slate-200">{inc.recommended}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn size="sm" icon={<ScanLine size={13} />} onClick={() => { select(inc.batchId); navigate('/app/verification' + (inc.qrId ? `?qr=${inc.qrId}` : '')) }}>Verify QR</Btn>
              <Btn size="sm" icon={<Fingerprint size={13} />} onClick={() => { select(inc.batchId); navigate('/app/packaging') }}>Packaging</Btn>
              <Btn size="sm" onClick={() => { select(inc.batchId); navigate('/app/blockchain') }}>Ledger</Btn>
            </div></Card>
          <Card title="Response timeline" icon={<Clock size={14} className="text-slate-400" />}>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {inc.timeline.map((t, i) => (<li key={i} className="relative"><span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-brand" /><div className="text-[12.5px] text-slate-100">{t.text}</div><div className="text-[11px] text-slate-500">{fmtDateTime(t.t)}</div></li>))}
            </ol>
          </Card>
          {a && <Card title="Batch status now"><Kv k="Status" v={<StatusBadge status={a.status} />} /><Kv k="Authenticity" v={`${a.trust.authenticity.toFixed(1)}%`} /><Kv k="Trust score" v={`${a.trust.trust}/100`} /><Kv k="Hash chain" v={a.chain.valid ? <span className="text-ok">VALID</span> : <span className="text-bad">COMPROMISED</span>} /></Card>}
        </div>
      </div>
    </>
  )
}
