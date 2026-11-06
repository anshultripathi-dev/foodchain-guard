import { Printer, Download } from 'lucide-react'
import { Badge, Btn, Card, Check2, HashText, ScoreRing, Kv } from '../../components/ui'
import type { BatchAnalysis } from '../../services/analysis'
import { identityHash } from '../../services/identity'
import { fingerprintComponents, fingerprintDigest } from '../../services/packaging'
import { fmtDateTime, downloadText, cn } from '../../utils/format'
import { NOW } from '../../utils/clock'
import { THREAT_LABEL } from '../../models/types'

export function AuthenticityReport({ a }: { a: BatchAnalysis }) {
  const b = a.batch
  const t = a.trust
  const checks: Array<[string, boolean, string]> = [
    ['QR', a.qr.status === 'VALID' || a.qr.status === 'UNKNOWN' && false, a.qr.status === 'VALID' ? `${a.qr.qrId} · active, ${a.qr.scans.length} scans, consistent` : a.qr.status],
    ['Packaging', a.classification.label === 'AUTHENTIC', `${a.packaging.overall.toFixed(0)}% fingerprint match · ${a.classification.label}`],
    ['Watermark', a.packaging.watermarkValid, a.packaging.watermarkValid ? 'embedded signal intact' : 'signal destroyed in lower-right region'],
    ['Cryptographic record', a.chain.valid, a.chain.valid ? `${a.events.length}/${a.events.length} blocks verified (SHA-256 + signatures)` : `${a.chain.invalidCount} block(s) untrusted`],
    ['Supply chain', a.unaccounted === 0 && !a.qr.replay && !a.cold.violation && a.days >= 0, a.unaccounted ? `${a.unaccounted} ${b.unit} unaccounted` : a.cold.violation ? 'cold-chain violation' : a.qr.replay ? 'location inconsistent' : a.days < 0 ? 'expired' : 'route, quantity, storage consistent'],
    ['Certification', b.certValid, b.certValid ? `${b.certification} · ${b.certId}` : 'failed registry verification'],
  ]
  const ok = t.verdict === 'AUTHENTIC'
  const fpDigest = fingerprintDigest(fingerprintComponents(b.batchId, a.worstPackage.mods))
  const exportJson = () => downloadText(`authenticity-${b.batchId}.json`, JSON.stringify({ batchId: b.batchId, generatedAt: new Date(NOW).toISOString(), verdict: t.verdict, authenticity: t.authenticity, trust: t.trust, checks: checks.map(([n, v, d]) => ({ check: n, pass: v, detail: d })), anomalies: a.anomalies }, null, 2))
  return (
    <Card
      glow={ok}
      title="Product authenticity report"
      subtitle={`${b.emoji} ${b.product} · ${b.batchId} · generated ${fmtDateTime(NOW)}`}
      right={<><Btn size="sm" icon={<Download size={13} />} onClick={exportJson}>JSON</Btn><Btn size="sm" icon={<Printer size={13} />} onClick={() => window.print()}>Print</Btn></>}
    >
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <ScoreRing value={t.authenticity} size={170} stroke={14} label={`${t.authenticity.toFixed(1)}%`} sub="authenticity" />
          <div className={cn('rounded-xl border-2 px-5 py-2 text-center text-[15px] font-extrabold tracking-wider', ok ? 'border-ok/50 bg-ok/10 text-ok' : t.verdict === 'SUSPICIOUS' ? 'border-warn/50 bg-warn/10 text-warn' : 'border-bad/50 bg-bad/10 text-bad')}>
            {ok ? 'AUTHENTIC PRODUCT' : 'COUNTERFEIT / SUSPICIOUS'}
          </div>
          <div className="text-[11px] text-slate-500">Trust score {t.trust}/100 · security {t.security}</div>
        </div>
        <div>
          <table className="tbl">
            <thead><tr><th>Check</th><th>Result</th><th>Evidence</th></tr></thead>
            <tbody>{checks.map(([n, v, d]) => (<tr key={n}><td className="font-medium text-slate-100">{n}</td><td><Check2 ok={v} label={v ? 'PASS' : 'FAIL'} /></td><td className="text-[12.5px] text-slate-400">{d}</td></tr>))}</tbody>
          </table>
          {!ok && (
            <div className="mt-4 rounded-xl border border-bad/30 bg-bad/[0.07] p-4">
              <div className="mb-2 text-[13px] font-semibold text-bad">Why this product is flagged</div>
              <ul className="list-disc space-y-1 pl-5 text-[12.5px] text-slate-300">
                {a.anomalies.map((x) => <li key={x.id}><b className="text-slate-100">{THREAT_LABEL[x.type]}:</b> {x.title} <span className="text-slate-500">(AI confidence {x.confidence}%)</span></li>)}
                {t.caps.map((c) => <li key={c}>Score capped: {c}</li>)}
              </ul>
              <p className="mt-3 text-[12.5px] text-slate-300">{t.conclusion}</p>
            </div>
          )}
          {ok && <p className="mt-4 rounded-xl border border-ok/25 bg-ok/[0.06] p-3 text-[12.5px] text-slate-300">{t.conclusion}</p>}
        </div>
      </div>
      <div className="mt-5 grid gap-x-10 border-t border-line pt-4 md:grid-cols-2">
        <div>
          <Kv k="Identity hash" v={<HashText hash={identityHash(b)} n={10} />} />
          <Kv k="Latest block hash" v={a.events.length ? <HashText hash={a.events[a.events.length - 1].currentHash} n={10} /> : '—'} />
        </div>
        <div>
          <Kv k="Fingerprint digest" v={<HashText hash={fpDigest} n={10} />} />
          <Kv k="Verification" v={<Badge tone={ok ? 'ok' : 'bad'} dot>{ok ? 'CROSS-VERIFIED' : 'NOT VERIFIED'}</Badge>} />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">AI components report calibrated confidence, not certainty. Borderline results should be confirmed by physical inspection.</p>
    </Card>
  )
}
