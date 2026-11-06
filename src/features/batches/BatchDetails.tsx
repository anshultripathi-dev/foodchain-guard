import { useState } from 'react'
import { AlertTriangle, Ban, Boxes, FileText, Fingerprint, Lock, ScanLine, Undo2 } from 'lucide-react'
import { Badge, Bar, Btn, Card, Kv, PageHeader, ScoreRing, SeverityBadge, StatusBadge, scoreTone, HashText } from '../../components/ui'
import { PackageViewer3D } from '../../components/3d/PackageViewer'
import { useStore } from '../../state/store'
import { useBatchAnalysis } from '../../state/selectors'
import { CrossVerify } from '../verification/CrossVerify'
import { EventTimeline } from '../supply-chain/EventTimeline'
import { TRUST_LABEL, type TrustKey } from '../../services/analysis'
import { fmtDate, fmtNum, cn } from '../../utils/format'
import { navigate, Link } from '../../utils/router'
import { THREAT_LABEL } from '../../models/types'
import { ROLE_BY_ID } from '../../data/roles'
import { expiryLabel } from '../../services/analysis'

export function BatchDetails({ id }: { id: string }) {
  const a = useBatchAnalysis(id)
  const { select, blockBatch, role } = useStore((s) => ({ select: s.selectBatch, blockBatch: s.blockBatch, role: s.role }))
  const [rot, setRot] = useState(true)
  if (!a) return <Card title="Batch not found"><Link to="/app/batches" className="text-brand">← Back to registry</Link></Card>
  const b = a.batch
  const go = (to: string) => { select(b.batchId); navigate(to) }
  const canAct = role === 'admin' || role === 'analyst'
  const pkg = a.worstPackage

  const facts: Array<[string, React.ReactNode]> = [
    ['Product', `${b.emoji} ${b.product}`], ['Origin', b.origin], ['Farm', b.farm], ['Harvest', fmtDate(b.harvestDate)], ['Processing', fmtDate(b.processingDate)],
    ['Quantity', `${fmtNum(b.quantity)} ${b.unit}`], ['Certification', <>{b.certification} {b.certValid ? <Badge tone="ok">valid</Badge> : <Badge tone="bad">FAILED</Badge>}</>],
    ['Expiry', <>{fmtDate(b.expiryDate)} <span className={a.days <= 4 ? 'text-warn' : 'text-slate-500'}>({expiryLabel(a.days) === 'SAFE' ? `${a.days}d left` : expiryLabel(a.days)})</span></>],
    ['Current location', a.currentLocation], ['Current owner', a.currentOwner], ['Current stage', a.stage],
  ]

  return (
    <>
      <PageHeader
        eyebrow={<Link to="/app/batches" className="hover:underline">← Batch registry</Link> as unknown as string}
        title={<span className="flex flex-wrap items-center gap-3"><span className="mono">{b.batchId}</span><StatusBadge status={a.status} /></span>}
        subtitle={`${b.emoji} ${b.product} · ${b.origin}`}
        actions={
          <>
            <Btn icon={<ScanLine size={14} />} onClick={() => go('/app/verification')}>Verify</Btn>
            <Btn icon={<Boxes size={14} />} onClick={() => go('/app/supply-chain')}>Trace in 3D</Btn>
            <Btn icon={<Fingerprint size={14} />} onClick={() => go('/app/identity')}>Digital identity</Btn>
            <Btn icon={<FileText size={14} />} onClick={() => go('/app/reports')}>Report</Btn>
            {canAct && (b.hold === 'BLOCKED'
              ? <Btn variant="ok" icon={<Undo2 size={14} />} onClick={() => blockBatch(b.batchId, false)}>Lift block</Btn>
              : <Btn variant="danger" icon={<Ban size={14} />} onClick={() => blockBatch(b.batchId, true)}>Block batch</Btn>)}
          </>
        }
      />

      {b.hold !== 'NONE' && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-bad/40 bg-bad/10 px-5 py-3 text-[13px] text-bad">
          <Ban size={18} /> <b>{b.hold === 'BLOCKED' ? 'This batch is BLOCKED network-wide.' : 'This batch has been RECALLED.'}</b>
          <span className="text-slate-300">{b.hold === 'BLOCKED' ? 'Distribution and retail verification are halted pending investigation.' : 'All custodians have been notified; units must be quarantined.'}</span>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Batch intelligence" className="xl:col-span-1">
          {facts.map(([k, v]) => <Kv key={k} k={k} v={v} />)}
        </Card>

        <Card title="Scores" className="xl:col-span-1">
          <div className="flex items-center gap-5">
            <ScoreRing value={a.trust.authenticity} size={116} stroke={11} label={`${a.trust.authenticity.toFixed(1)}`} sub="authentic %" />
            <div className="flex-1 space-y-3">
              {([['Chain integrity', a.scores.chainIntegrity], ['Food safety', a.scores.foodSafety], ['Packaging', a.scores.packaging]] as const).map(([l, v]) => (
                <div key={l}><div className="mb-1 flex justify-between text-xs text-slate-400"><span>{l}</span><span className="font-semibold text-slate-100">{v}{l === 'Food safety' ? '/100' : '%'}</span></div><Bar value={v} /></div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-line p-3"><div className="label">Packaging status</div><div className={cn('mt-1 font-semibold', a.classification.label === 'AUTHENTIC' ? 'text-ok' : 'text-bad')}>{a.classification.label}</div><div className="text-slate-500">{a.packaging.overall.toFixed(0)}% fingerprint match</div></div>
            <div className="rounded-xl border border-line p-3"><div className="label">Hash chain</div><div className={cn('mt-1 font-semibold', a.chain.valid ? 'text-ok' : 'text-bad')}>{a.chain.valid ? 'VALID' : 'COMPROMISED'}</div><div className="text-slate-500">{a.events.length} blocks</div></div>
            <div className="rounded-xl border border-line p-3"><div className="label">Security</div><div className={cn('mt-1 font-semibold', a.trust.security === 'SECURE' ? 'text-ok' : a.trust.security === 'WATCH' ? 'text-warn' : 'text-bad')}>{a.trust.security}</div><div className="text-slate-500">{a.anomalies.length} signals</div></div>
            <div className="rounded-xl border border-line p-3"><div className="label">Trust score</div><div className={cn('mt-1 font-semibold', scoreTone(a.trust.trust) === 'ok' ? 'text-ok' : scoreTone(a.trust.trust) === 'warn' ? 'text-warn' : 'text-bad')}>{a.trust.trust}/100</div><div className="text-slate-500">{a.trust.verdict}</div></div>
          </div>
        </Card>

        <Card title="3D package preview" className="xl:col-span-1" right={<Btn size="sm" variant="ghost" onClick={() => setRot(!rot)}>{rot ? 'Pause' : 'Rotate'}</Btn>} bodyClassName="!p-3">
          <PackageViewer3D batch={b} qrId={pkg.qrId} watermarkId={pkg.watermarkId} mods={pkg.mods} autoRotate={rot} height={330} />
          <div className="mt-2 flex items-center justify-between px-2 text-xs text-slate-400">
            <span className="mono">{pkg.packageId}</span><Link to="/app/packaging" className="text-brand hover:underline" onClick={() => select(b.batchId)}>Inspect packaging →</Link>
          </div>
        </Card>
      </div>

      <div className="mt-5"><CrossVerify a={a} /></div>

      <div className="mt-5 grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Supply-chain history" subtitle="Each block is signed by its custodian and chained by SHA-256">
          <EventTimeline a={a} />
        </Card>
        <div className="space-y-5 xl:col-span-2">
          <Card title="Security signals" subtitle={a.anomalies.length ? `${a.anomalies.length} active` : 'No active anomalies'}>
            {a.anomalies.length === 0 && <div className="flex items-center gap-2 text-sm text-ok"><Lock size={15} /> All verification layers agree.</div>}
            <div className="space-y-2.5">
              {a.anomalies.map((x) => (
                <div key={x.id} className="rounded-xl border border-line bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-semibold text-white">{THREAT_LABEL[x.type]}</span><SeverityBadge s={x.severity} /></div>
                  <div className="mt-1 flex items-start gap-1.5 text-xs text-slate-300"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn" />{x.title}</div>
                  <div className="mt-1 text-[11px] text-slate-500">AI confidence {x.confidence}% · {x.recommended}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Trust engine inputs" subtitle="10 independent signals">
            <div className="space-y-2.5">
              {(Object.keys(a.trust.components) as TrustKey[]).map((k) => (
                <div key={k}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-slate-400">{TRUST_LABEL[k]}</span><span className="mono text-slate-200">{a.trust.components[k].toFixed(k === 'packaging' || k === 'blockchain' ? 1 : 0)}</span></div>
                  <Bar value={a.trust.components[k]} height={5} />
                </div>
              ))}
            </div>
          </Card>
          <Card title="Identifiers">
            <Kv k="QR ID" v={<span className="mono">{pkg.qrId}</span>} /><Kv k="Fingerprint" v={<span className="mono">{b.packagingFingerprint}</span>} /><Kv k="Watermark" v={<span className="mono">{b.watermarkId}</span>} />
            <Kv k="Latest hash" v={a.events.length ? <HashText hash={a.events[a.events.length - 1].currentHash} n={9} /> : '—'} />
            <div className="pt-2 text-[11px] text-slate-500">Role view: {ROLE_BY_ID[role].label}</div>
          </Card>
        </div>
      </div>
    </>
  )
}
