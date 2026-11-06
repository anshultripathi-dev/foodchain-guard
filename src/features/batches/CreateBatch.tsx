import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Fingerprint, Key, Link2, Lock, QrCode, Sparkles, Loader2 } from 'lucide-react'
import { Btn, Card, Field, HashText, PageHeader, Badge } from '../../components/ui'
import { PackageImage } from '../../components/PackageImage'
import { useStore, type RegisterForm } from '../../state/store'
import { ACTORS, PRODUCTS } from '../../data/catalog'
import { NOW, DAY } from '../../utils/clock'
import { fmtDate } from '../../utils/format'
import { navigate } from '../../utils/router'
import type { Batch } from '../../models/types'
import { useAnalysis } from '../../state/selectors'

const toInput = (ms: number) => new Date(ms + 5.5 * 3600_000).toISOString().slice(0, 10)
const fromInput = (s: string) => new Date(s + 'T10:00:00+05:30').getTime()

const STEPS = [
  { icon: <Lock size={15} />, label: 'Sensitive metadata encrypted', detail: 'AES-256-GCM (simulated) in secure storage' },
  { icon: <Key size={15} />, label: 'SHA-256 integrity hash computed', detail: 'Digest of the encrypted record' },
  { icon: <QrCode size={15} />, label: 'QR identity issued', detail: 'Bound to batch + package + fingerprint' },
  { icon: <Fingerprint size={15} />, label: 'Packaging fingerprint generated', detail: 'Logo, typography, colour, layout, micro-pattern, watermark' },
  { icon: <Link2 size={15} />, label: 'Ledger genesis block sealed', detail: 'Signed by the farm, linked to GENESIS' },
]

export function CreateBatch() {
  const register = useStore((s) => s.registerBatch)
  const an = useAnalysis()
  const farms = ACTORS.filter((a) => a.type === 'FARM')
  const nextId = useMemo(() => `FCG-2026-${String(Math.max(...an.list.map((a) => parseInt(a.batch.batchId.slice(-5), 10))) + 1).padStart(5, '0')}`, [an.list.length])
  const [f, setF] = useState<RegisterForm>({
    productIdx: 0, farmId: 'farm-1', harvestDate: NOW, processingDate: NOW + 2 * DAY, expiryDate: NOW + 16 * DAY, quantity: 2400,
    certification: 'Organic', storageMin: 2, storageMax: 8, humidityMin: 70, humidityMax: 92,
  })
  const [phase, setPhase] = useState(-1)
  const [done, setDone] = useState<Batch | null>(null)
  const spec = PRODUCTS[f.productIdx]
  const set = <K extends keyof RegisterForm>(k: K, v: RegisterForm[K]) => setF((x) => ({ ...x, [k]: v }))
  const geneis = done ? an.byId[done.batchId]?.events[0] : null

  const submit = () => {
    setPhase(0)
    STEPS.forEach((_, i) => setTimeout(() => setPhase(i + 1), (i + 1) * 650))
    setTimeout(() => setDone(register(f)), STEPS.length * 650 + 200)
  }

  const preview: Pick<Batch, 'product' | 'emoji' | 'brand' | 'batchId' | 'expiryDate' | 'certification'> = {
    product: spec.product, emoji: spec.emoji, brand: spec.brand, batchId: done?.batchId ?? nextId, expiryDate: f.expiryDate, certification: f.certification,
  }
  const pkg = an.byId[done?.batchId ?? '']?.packages[0]

  return (
    <>
      <PageHeader eyebrow="Batch registration" title="Register a new batch" subtitle="Registering a batch issues its digital identity: encrypted metadata, hash, QR, packaging fingerprint and a ledger genesis block." />
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Card title="Batch details" subtitle={<>Batch ID preview: <span className="mono text-brand">{done?.batchId ?? nextId}</span></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product">
              <select className="input" value={f.productIdx} onChange={(e) => { const i = +e.target.value; setF((x) => ({ ...x, productIdx: i, certification: PRODUCTS[i].certs[0], farmId: PRODUCTS[i].farmIds[0], expiryDate: x.harvestDate + PRODUCTS[i].shelfDays * DAY })) }}>
                {PRODUCTS.map((p, i) => <option key={p.product} value={i}>{p.emoji} {p.product}</option>)}
              </select>
            </Field>
            <Field label="Farm"><select className="input" value={f.farmId} onChange={(e) => set('farmId', e.target.value)}>{farms.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
            <Field label="Origin"><input className="input" readOnly value={`${farms.find((x) => x.id === f.farmId)!.city}, Maharashtra`} /></Field>
            <Field label={`Quantity (${spec.unit})`}><input type="number" className="input" value={f.quantity} onChange={(e) => set('quantity', Math.max(1, +e.target.value))} /></Field>
            <Field label="Harvest date"><input type="date" className="input" value={toInput(f.harvestDate)} onChange={(e) => set('harvestDate', fromInput(e.target.value))} /></Field>
            <Field label="Processing date"><input type="date" className="input" value={toInput(f.processingDate)} onChange={(e) => set('processingDate', fromInput(e.target.value))} /></Field>
            <Field label="Expiry date" hint={`Typical shelf life ${spec.shelfDays} days`}><input type="date" className="input" value={toInput(f.expiryDate)} onChange={(e) => set('expiryDate', fromInput(e.target.value))} /></Field>
            <Field label="Certification">
              <select className="input" value={f.certification} onChange={(e) => set('certification', e.target.value)}>
                {['Organic', 'GlobalGAP', 'FSSAI Premium', 'Fair Trade', 'Conventional'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Storage temperature (°C)">
              <div className="flex items-center gap-2"><input type="number" className="input" value={f.storageMin} onChange={(e) => set('storageMin', +e.target.value)} /><span className="text-slate-500">to</span><input type="number" className="input" value={f.storageMax} onChange={(e) => set('storageMax', +e.target.value)} /></div>
            </Field>
            <Field label="Humidity (%)">
              <div className="flex items-center gap-2"><input type="number" className="input" value={f.humidityMin} onChange={(e) => set('humidityMin', +e.target.value)} /><span className="text-slate-500">to</span><input type="number" className="input" value={f.humidityMax} onChange={(e) => set('humidityMax', +e.target.value)} /></div>
            </Field>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Btn variant="primary" size="lg" icon={phase >= 0 && !done ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} onClick={submit} disabled={phase >= 0 && !done}>Register & generate identity</Btn>
            {done && <Btn onClick={() => navigate(`/app/batches/${done.batchId}`)}>Open batch details →</Btn>}
          </div>
        </Card>

        <div className="space-y-5">
          <Card title="Identity issuance" subtitle="Generated automatically on registration">
            <ul className="space-y-3">
              {STEPS.map((s, i) => {
                const on = phase > i
                const run = phase === i
                return (
                  <li key={s.label} className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${on ? 'border-ok/50 bg-ok/15 text-ok' : run ? 'border-brand/50 bg-brand/10 text-brand' : 'border-line text-slate-600'}`}>
                      {on ? <Check size={14} /> : run ? <Loader2 size={14} className="animate-spin" /> : s.icon}
                    </span>
                    <div><div className={`text-[13px] font-medium ${on || run ? 'text-slate-100' : 'text-slate-500'}`}>{s.label}</div><div className="text-xs text-slate-500">{s.detail}</div></div>
                  </li>
                )
              })}
            </ul>
            {done && geneis && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-2 rounded-xl border border-ok/30 bg-ok/[0.06] p-3 text-xs">
                <div className="flex items-center justify-between"><Badge tone="ok" dot>Digital identity valid</Badge><span className="mono text-slate-400">{done.batchId}</span></div>
                <div>Genesis hash <HashText hash={geneis.currentHash} n={12} /></div>
                <div>QR ID <span className="mono text-slate-200">{done.qrId}</span></div>
                <div>Fingerprint <span className="mono text-slate-200">{done.packagingFingerprint}</span></div>
              </motion.div>
            )}
          </Card>
          <Card title="Package preview" subtitle={`Registered design · exp ${fmtDate(f.expiryDate)}`}>
            <div className="mx-auto w-[220px]">
              <PackageImage batch={{ ...(an.list[0].batch), ...preview } as Batch} qrId={pkg?.qrId ?? 'QR-FCG-' + nextId.slice(-5)} watermarkId={done?.watermarkId ?? 'WM-PENDING'} />
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
