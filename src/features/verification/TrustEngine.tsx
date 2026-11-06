import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Cpu, RefreshCw } from 'lucide-react'
import { AnimatedNumber, Badge, Bar, Btn, Card, ScoreRing, scoreTone } from '../../components/ui'
import { useSelectedAnalysis } from '../../state/selectors'
import { TRUST_LABEL, type TrustKey } from '../../services/analysis'
import { cn } from '../../utils/format'

const WEIGHT: Record<TrustKey, number> = { packaging: 16, qr: 8, watermark: 8, blockchain: 12, supplyChain: 8, location: 8, quantity: 10, temperature: 12, expiry: 12, certification: 6 }
const GROUP: Record<TrustKey, string> = { packaging: 'Physical', watermark: 'Physical', qr: 'Digital', blockchain: 'Digital', certification: 'Digital', supplyChain: 'Supply chain', location: 'Supply chain', quantity: 'Supply chain', temperature: 'Supply chain', expiry: 'Supply chain' }

export function TrustEngine() {
  const a = useSelectedAnalysis()
  const t = a.trust
  const [calc, setCalc] = useState(0)
  const [spin, setSpin] = useState(false)
  const recalc = () => { setSpin(true); setCalc((c) => c + 1); setTimeout(() => setSpin(false), 1400) }
  useEffect(() => { recalc() }, [a.batch.batchId, t.trust])
  const keys = Object.keys(t.components) as TrustKey[]
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[1fr_260px_1fr]">
        <Card title="Inputs" subtitle="Ten independent signals, each 0–100">
          <div className="space-y-3">
            {keys.map((k, i) => (
              <motion.div key={k} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-200">{TRUST_LABEL[k]} <span className="text-[10px] text-slate-500">{GROUP[k]} · w{WEIGHT[k]}%</span></span>
                  <span className="mono font-semibold text-slate-100">{t.components[k].toFixed(k === 'packaging' || k === 'blockchain' ? 1 : 0)}</span>
                </div>
                <Bar value={t.components[k]} height={6} />
              </motion.div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col items-center justify-center gap-4">
          <div className="relative flex h-56 w-56 items-center justify-center">
            <motion.div className="absolute inset-0 rounded-full border-2 border-dashed border-brand/40" animate={{ rotate: spin ? 360 : 0 }} transition={{ duration: 1.4, ease: 'easeInOut' }} />
            <motion.div className="absolute inset-4 rounded-full border border-vio/40" animate={{ rotate: spin ? -360 : 0 }} transition={{ duration: 1.4, ease: 'easeInOut' }} />
            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-brand/20 to-vio/20 blur-xl" />
            <div className="relative text-center">
              <Cpu className="mx-auto mb-1 text-brand" size={22} />
              <div className="label">Trust engine</div>
              <div className="text-5xl font-extrabold text-white tabular-nums"><AnimatedNumber key={calc} value={t.trust} duration={1200} /></div>
              <div className="text-[11px] text-slate-400">/ 100</div>
            </div>
          </div>
          <Btn size="sm" icon={<RefreshCw size={13} />} onClick={recalc}>Recalculate</Btn>
          <div className="flex gap-1 text-slate-600">{[0, 1, 2].map((i) => <motion.span key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}>▶</motion.span>)}</div>
        </div>

        <div className="space-y-5">
          <Card title="Outputs" glow>
            <div className="flex items-center gap-5">
              <ScoreRing value={t.trust} size={112} stroke={11} sub="trust score" />
              <div className="space-y-2 text-[13px]">
                <div><span className="label">Verdict</span><div className={cn('text-xl font-extrabold', t.verdict === 'AUTHENTIC' ? 'text-ok' : t.verdict === 'SUSPICIOUS' ? 'text-warn' : 'text-bad')}>{t.verdict}</div></div>
                <div><span className="label">Security status</span><div><Badge tone={t.security === 'SECURE' ? 'ok' : t.security === 'WATCH' ? 'warn' : 'bad'} dot>{t.security}</Badge></div></div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-400">Authenticity {t.authenticity.toFixed(1)}% · food safety {a.scores.foodSafety}/100</div>
            {t.caps.length > 0 && <div className="mt-3 space-y-1">{t.caps.map((c) => <div key={c} className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-1.5 text-xs text-bad">Hard cap: {c}</div>)}</div>}
          </Card>
          <Card title="Individual risk values" subtitle="100 − signal score">
            <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
              {keys.map((k) => (
                <div key={k} className="text-xs"><div className="mb-1 flex justify-between"><span className="text-slate-400">{TRUST_LABEL[k]}</span><span className={cn('mono font-semibold', t.risks[k] < 15 ? 'text-ok' : t.risks[k] < 40 ? 'text-warn' : 'text-bad')}>{t.risks[k]}</span></div><Bar value={t.risks[k]} tone={t.risks[k] < 15 ? 'ok' : t.risks[k] < 40 ? 'warn' : 'bad'} height={4} /></div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <Card className="mt-5" title="How the score is computed">
        <p className="text-[13px] leading-relaxed text-slate-300">Weighted mean of the ten signals, then <b className="text-white">hard caps</b> apply: a broken hash chain, invalid watermark, QR replay, counterfeit-class packaging or failed certificate each cap the score regardless of how good the other signals look. This prevents a strong QR or a valid ledger from masking a forged package — the core cross-verified-trust rule.</p>
      </Card>
    </>
  )
}
export { scoreTone }
