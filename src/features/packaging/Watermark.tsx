import { useMemo } from 'react'
import { Check, X } from 'lucide-react'
import { Badge, Card, Check2 } from '../../components/ui'
import { PackageImage } from '../../components/PackageImage'
import { useSelectedAnalysis } from '../../state/selectors'
import { extractWatermark } from '../../services/packaging'
import { cn } from '../../utils/format'
import { PackageLab } from './PackagingVerification'

function BitGrid({ bits, errors, label, tone }: { bits: number[]; errors?: number[]; label: string; tone: string }) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="grid grid-cols-16 gap-[3px]" style={{ gridTemplateColumns: 'repeat(16,1fr)' }}>
        {bits.map((v, i) => <span key={i} className={cn('aspect-square rounded-[3px]', v ? tone : 'bg-white/[0.06]', errors?.includes(i) && 'ring-2 ring-bad')} />)}
      </div>
    </div>
  )
}

export function Watermark() {
  const a = useSelectedAnalysis()
  const pk = a.worstPackage
  const w = useMemo(() => extractWatermark(pk.watermarkId, pk.mods), [pk.watermarkId, pk.mods])
  const ber = (w.errors.length / 128) * 100
  const present = true
  const integrity = a.packaging.watermarkValid
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <Card title="Watermark verification" subtitle={`Embedded 128-bit signal · ID ${pk.watermarkId}`} right={<Badge tone={integrity ? 'ok' : 'bad'} dot>{integrity ? 'VALID' : 'INVALID'}</Badge>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-4"><div className="label mb-1">Watermark present</div><Check2 ok={present && integrity} label={integrity ? 'Detected' : 'Signal destroyed'} /></div>
            <div className="rounded-xl border border-line p-4"><div className="label mb-1">Watermark integrity</div><Check2 ok={integrity} label={integrity ? `BER ${ber.toFixed(1)}% · corrected` : `BER ${ber.toFixed(0)}% · uncorrectable`} /></div>
            <div className="rounded-xl border border-line p-4"><div className="label mb-1">Embedding region</div><div className="text-[13px] text-slate-100">Lower-right panel · 16 × 8 cells</div></div>
            <div className="rounded-xl border border-line p-4"><div className="label mb-1">Security pattern</div><Check2 ok={a.packaging.pattern > 70} label={`${a.packaging.pattern.toFixed(0)}% match`} /></div>
          </div>
        </Card>
        <Card title="Signal extraction" subtitle="Expected bits (from the ledger) vs bits recovered from the scan">
          <div className="grid gap-5 md:grid-cols-3">
            <BitGrid bits={w.expected} label="Expected" tone="bg-brand/70" />
            <BitGrid bits={w.extracted} errors={w.errors} label="Extracted" tone={integrity ? 'bg-ok/70' : 'bg-warn/70'} />
            <div>
              <div className="label mb-1.5">Error map</div>
              <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(16,1fr)' }}>{w.expected.map((_, i) => <span key={i} className={cn('aspect-square rounded-[3px]', w.errors.includes(i) ? 'bg-bad' : 'bg-ok/30')} />)}</div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">{integrity ? <Check size={13} className="text-ok" /> : <X size={13} className="text-bad" />}<span className={integrity ? 'text-ok' : 'text-bad'}>{w.errors.length} / 128 bits differ</span></div>
            </div>
          </div>
          {!integrity && <div className="mt-4 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">Watermark: <b>INVALID</b>. Affected region: lower-right panel (rows 3–7, columns 9–15) — the area was reprinted, which destroys the embedded signal.</div>}
        </Card>
        <PackageLab pkgId={pk.packageId} mods={pk.mods} />
      </div>
      <Card title="Watermark layer revealed" subtitle="Hidden signal made visible by the verifier">
        <div className="mx-auto max-w-[300px]">
          <PackageImage batch={a.batch} qrId={pk.qrId} watermarkId={pk.watermarkId} mods={pk.mods} revealWatermark highlights={integrity ? [{ region: 'watermark', color: '#34d399' }] : [{ region: 'watermark', color: '#f87171' }]} />
        </div>
      </Card>
    </div>
  )
}
