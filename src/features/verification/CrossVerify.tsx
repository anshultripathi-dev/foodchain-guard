import { Box, Fingerprint, GitBranch, Equal, X, Check } from 'lucide-react'
import type { ReactNode } from 'react'
import type { BatchAnalysis } from '../../services/analysis'
import { cn } from '../../utils/format'
import { Badge, Card, ScoreRing, scoreTone, TONE_TEXT } from '../../components/ui'

function Truth({ title, icon, score, items }: { title: string; icon: ReactNode; score: number; items: Array<[string, boolean, string?]> }) {
  const t = scoreTone(score)
  return (
    <div className={cn('rounded-2xl border p-4', score >= 85 ? 'border-ok/25 bg-ok/[0.04]' : score >= 60 ? 'border-warn/30 bg-warn/[0.05]' : 'border-bad/40 bg-bad/[0.06]')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-white"><span className={TONE_TEXT[t]}>{icon}</span>{title}</div>
        <ScoreRing value={score} size={54} stroke={6} />
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map(([l, ok, note]) => (
          <li key={l} className="flex items-start gap-2 text-[12.5px]">
            <span className={cn('mt-0.5 shrink-0', ok ? 'text-ok' : 'text-bad')}>{ok ? <Check size={14} /> : <X size={14} />}</span>
            <span className="text-slate-300">{l}{note && <span className="ml-1.5 text-slate-500">{note}</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CrossVerify({ a, compact }: { a: BatchAnalysis; compact?: boolean }) {
  const { truths, components } = a.trust
  const agree = truths.physical >= 75 && truths.digital >= 75 && truths.supply >= 75
  return (
    <Card
      glow={agree}
      title="Cross-verified trust"
      subtitle="Physical truth ↔ digital truth ↔ supply-chain truth — all three must agree"
      right={<Badge tone={agree ? 'ok' : 'bad'} dot pulse={!agree}>{agree ? 'ALL THREE AGREE' : 'TRUTHS DISAGREE'}</Badge>}
    >
      <div className={cn('grid items-stretch gap-3', compact ? 'lg:grid-cols-3' : 'lg:grid-cols-[1fr_auto_1fr_auto_1fr]')}>
        <Truth
          title="Physical truth" icon={<Box size={16} />} score={truths.physical}
          items={[
            ['Packaging fingerprint', a.packaging.overall >= 85, `${a.packaging.overall.toFixed(0)}% match`],
            ['Watermark integrity', a.packaging.watermarkValid, a.packaging.watermarkValid ? 'embedded signal intact' : 'signal destroyed'],
            ['QR print quality', a.packaging.qrValid, a.packaging.qrValid ? undefined : 'distorted'],
          ]}
        />
        {!compact && <div className="hidden items-center lg:flex"><span className={cn('rounded-full border p-1.5', truths.physical >= 75 && truths.digital >= 75 ? 'border-ok/40 text-ok' : 'border-bad/50 text-bad')}>{truths.physical >= 75 && truths.digital >= 75 ? <Equal size={16} /> : <X size={16} />}</span></div>}
        <Truth
          title="Digital truth" icon={<Fingerprint size={16} />} score={truths.digital}
          items={[
            ['QR identity', components.qr >= 85, a.qr.status],
            ['Cryptographic record', a.chain.valid, a.chain.valid ? 'hash chain valid' : `${a.chain.invalidCount} blocks untrusted`],
            ['Certification', a.batch.certValid, a.batch.certValid ? a.batch.certification : 'failed verification'],
          ]}
        />
        {!compact && <div className="hidden items-center lg:flex"><span className={cn('rounded-full border p-1.5', truths.digital >= 75 && truths.supply >= 75 ? 'border-ok/40 text-ok' : 'border-bad/50 text-bad')}>{truths.digital >= 75 && truths.supply >= 75 ? <Equal size={16} /> : <X size={16} />}</span></div>}
        <Truth
          title="Supply-chain truth" icon={<GitBranch size={16} />} score={truths.supply}
          items={[
            ['Location consistency', components.location >= 85, a.qr.cities.length ? a.qr.cities.join(' · ') : undefined],
            ['Quantity consistency', a.unaccounted === 0 && !a.qty.some((s) => s.kind === 'GAIN'), a.unaccounted ? `${a.unaccounted} unaccounted` : undefined],
            ['Storage conditions', !a.cold.violation, `${a.cold.current.toFixed(1)}°C`],
            ['Expiry status', a.days >= 0, a.days >= 0 ? `${a.days} days left` : `expired ${-a.days}d ago`],
          ]}
        />
      </div>
      <div className={cn('mt-4 rounded-xl border px-4 py-3 text-[13px] font-medium', agree ? 'border-ok/30 bg-ok/10 text-ok' : 'border-bad/40 bg-bad/10 text-bad')}>
        {agree ? '✓ ' : '⚠ '}{a.trust.conclusion}
      </div>
    </Card>
  )
}
