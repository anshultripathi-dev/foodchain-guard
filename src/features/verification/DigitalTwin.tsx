import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Box, Brain, Camera, Cpu, Fingerprint, Hash, Link2, Play, QrCode, ShieldCheck } from 'lucide-react'
import { Btn, Card } from '../../components/ui'
import { useSelectedAnalysis } from '../../state/selectors'
import { cn } from '../../utils/format'

export function DigitalTwin() {
  const a = useSelectedAnalysis()
  const [step, setStep] = useState(9)
  const timers = useRef<number[]>([])
  const run = () => {
    timers.current.forEach(clearTimeout); timers.current = []
    setStep(0)
    for (let i = 1; i <= 9; i++) timers.current.push(window.setTimeout(() => setStep(i), i * 750))
  }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const t = a.trust
  const bad = t.verdict !== 'AUTHENTIC'
  const nodes = [
    { icon: <Box size={20} />, title: 'Physical package', sub: 'the real item in hand', val: a.worstPackage.packageId },
    { icon: <Camera size={20} />, title: 'Camera', sub: 'multi-spectral capture', val: '4032×3024 · raking light' },
    { icon: <Brain size={20} />, title: 'AI vision', sub: 'CNN feature extraction', val: `${a.classification.label.toLowerCase()} · ${a.classification.confidence.toFixed(0)}%` },
    { icon: <Fingerprint size={20} />, title: 'Packaging fingerprint', sub: 'compare with registered', val: `${a.batch.packagingFingerprint} · ${a.packaging.overall.toFixed(0)}% match` },
    { icon: <QrCode size={20} />, title: 'QR identity', sub: 'decode & resolve', val: `${a.qr.qrId} · ${a.qr.status}` },
    { icon: <Hash size={20} />, title: 'Cryptographic ID', sub: 'identity hash + signature', val: a.events.length ? a.events[0].currentHash.slice(0, 14) + '…' : '—' },
    { icon: <Link2 size={20} />, title: 'Supply-chain ledger', sub: 'hash chain & history', val: a.chain.valid ? `${a.events.length} blocks valid` : `${a.chain.invalidCount} blocks untrusted` },
    { icon: <Cpu size={20} />, title: 'Trust engine', sub: '10 signals · hard caps', val: `trust ${t.trust}/100` },
    { icon: <ShieldCheck size={20} />, title: 'Authenticity result', sub: 'cross-verified verdict', val: t.verdict },
  ]
  return (
    <Card title="Digital twin verification pipeline" subtitle="From the physical item to a cross-verified verdict" right={<Btn size="sm" variant="primary" icon={<Play size={13} />} onClick={run}>Run pipeline</Btn>}>
      <div className="relative">
        <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.map((n, i) => {
            const on = step > i
            const cur = step === i + 1
            const final = i === 8
            return (
              <motion.div key={n.title} animate={{ scale: cur ? 1.03 : 1, opacity: on ? 1 : 0.4 }} className={cn('relative rounded-2xl border p-4', on ? (final ? (bad ? 'border-bad/60 bg-bad/10' : 'border-ok/60 bg-ok/10') : 'border-brand/40 bg-brand/[0.07]') : 'border-line bg-white/[0.02]', cur && 'shadow-[0_0_34px_-8px_#22d3ee]')}>
                <div className="flex items-center gap-3">
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', on ? (final ? (bad ? 'bg-bad/20 text-bad' : 'bg-ok/20 text-ok') : 'bg-brand/15 text-brand') : 'bg-white/5 text-slate-500')}>{n.icon}</span>
                  <div><div className="text-[11px] text-slate-500">{i + 1}</div><div className="text-[13.5px] font-semibold text-white">{n.title}</div></div>
                </div>
                <div className="mt-2 text-xs text-slate-400">{n.sub}</div>
                <div className={cn('mono mt-2 truncate text-[12px]', on ? (final ? (bad ? 'font-bold text-bad' : 'font-bold text-ok') : 'text-slate-200') : 'text-slate-600')}>{on ? n.val : '…'}</div>
                {i < nodes.length - 1 && (
                  <span className="absolute -bottom-5 left-1/2 hidden -translate-x-1/2 text-slate-600 sm:block lg:hidden">↓</span>
                )}
                {i < nodes.length - 1 && i % 3 !== 2 && (
                  <motion.span className="absolute -right-[18px] top-1/2 z-10 hidden -translate-y-1/2 text-brand lg:block" animate={{ x: step === i + 1 ? [0, 6, 0] : 0, opacity: on ? 1 : 0.3 }} transition={{ duration: 0.7, repeat: step === i + 1 ? Infinity : 0 }}>▶</motion.span>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
      <p className="mt-6 text-[13px] leading-relaxed text-slate-400">The pipeline always ends in the trust engine because no single stage can vouch for the product: a camera can be fooled by a good print, a QR can be copied, and a ledger only proves what was recorded — not what is in the box. Authenticity emerges only when all three agree.</p>
    </Card>
  )
}
