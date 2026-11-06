import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, Box, Brain, Eye, Fingerprint, GitBranch, Hash, Link2, Lock, Play, QrCode, ShieldCheck, Sprout, X, Check, Equal } from 'lucide-react'
import { navigate } from '../utils/router'
import { useStore } from '../state/store'
import { AnimatedNumber, Btn } from '../components/ui'
import { NODE_KEYS, type NodeKey, type NodeStatus } from '../components/3d/nodes'

const Scene = lazy(() => import('../components/3d/SupplyChainScene').then((m) => ({ default: m.SupplyChainScene })))
const NAMES: Record<NodeKey, string> = { farm: 'Green Valley Farm', processing: 'Processing Plant', distribution: 'Mumbai Distribution Hub', warehouse: 'Pune Cold Warehouse', retail: 'Mumbai Retail Network', consumer: 'Consumer' }
const OK = Object.fromEntries(NODE_KEYS.map((k) => [k, 'ok'])) as Record<NodeKey, NodeStatus>

function Stat({ v, d = 0, suffix = '', label }: { v: number; d?: number; suffix?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  return (
    <div ref={ref} className="px-6 py-7 text-center">
      <div className="text-4xl font-extrabold tracking-tight text-white md:text-5xl tabular-nums">{inView ? <AnimatedNumber value={v} decimals={d} suffix={suffix} duration={1600} /> : '0'}</div>
      <div className="mt-1.5 text-xs font-semibold uppercase tracking-[.16em] text-slate-400">{label}</div>
    </div>
  )
}

export function Landing() {
  const { loadDemo, setRole } = useStore((s) => ({ loadDemo: s.loadDemo, setRole: s.setRole }))
  const [show3d, setShow3d] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow3d(true), 150); return () => clearTimeout(t) }, [])
  const runDemo = () => { setRole('admin'); loadDemo(); navigate('/app/overview') }

  return (
    <div className="min-h-screen bg-aurora text-slate-200">
      <nav className="fixed inset-x-0 top-0 z-30 border-b border-white/5 bg-ink-950/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-ok text-ink-950"><ShieldCheck size={19} strokeWidth={2.4} /></span><span className="text-[15px] font-bold text-white">FoodChain Guard</span></div>
          <div className="hidden items-center gap-8 text-[13px] font-medium text-slate-400 md:flex"><a href="#truths" className="hover:text-white">Three truths</a><a href="#how" className="hover:text-white">How it works</a><a href="#layers" className="hover:text-white">Defence layers</a></div>
          <div className="flex gap-2"><Btn size="sm" variant="ghost" onClick={() => navigate('/consumer')}>I’m a shopper</Btn><Btn size="sm" variant="primary" onClick={() => navigate('/login')}>Launch Platform</Btn></div>
        </div>
      </nav>

      <section className="relative isolate overflow-hidden pt-16">
        <div className="absolute inset-0 -z-10 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="absolute inset-y-0 right-0 -z-10 w-full lg:w-[72%]">
          {show3d && <Suspense fallback={null}><Scene names={NAMES} statuses={OK} reached={6} selected={null} ambient showLabels={false} /></Suspense>}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />
        </div>
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center px-6 py-16">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-brand"><span className="relative flex h-2 w-2"><span className="absolute h-full w-full rounded-full bg-brand" style={{ animation: 'pulse-ring 1.6s infinite' }} /><span className="relative h-2 w-2 rounded-full bg-brand" /></span>Cross-verified trust platform</div>
            <h1 className="mt-6 text-6xl font-extrabold leading-[1.02] tracking-tight text-white md:text-7xl">Trust <span className="bg-gradient-to-r from-brand via-sky-300 to-ok bg-clip-text text-transparent">Every Bite.</span></h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-300">AI-powered physical, cryptographic, and supply-chain verification for food products.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Btn variant="primary" size="lg" icon={<ArrowRight size={18} />} onClick={() => navigate('/login')}>Launch Platform</Btn>
              <Btn size="lg" icon={<Play size={16} />} onClick={runDemo}>Run Security Demo</Btn>
            </div>
            <p className="mt-6 max-w-md text-[13px] leading-relaxed text-slate-500">A QR code can be copied. A ledger only proves what was recorded. FoodChain Guard keeps checking until the package, its digital identity and its history all agree.</p>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-ink-900/60 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-white/5 md:grid-cols-4 md:divide-x">
          <Stat v={99.2} d={1} suffix="%" label="Chain integrity" /><Stat v={12842} label="Verified batches" /><Stat v={427381} label="Products tracked" /><Stat v={184} label="Security events detected" />
        </div>
      </section>

      <section id="truths" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center"><div className="label text-brand">Core idea</div><h2 className="mt-3 text-4xl font-bold tracking-tight text-white">Three truths. All must agree.</h2><p className="mt-4 text-slate-400">Authenticity is not a QR scan. It is the continuous comparison of what the package looks like, what the record says, and how the batch actually travelled.</p></div>
        <div className="mt-12 grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {[{ i: <Box size={26} />, t: 'Physical truth', d: 'Packaging fingerprint · watermark · print quality — read by computer vision.', c: 'from-amber-500/20' }, { i: <Fingerprint size={26} />, t: 'Digital truth', d: 'QR identity · SHA-256 hash chain · digital signatures · certificates.', c: 'from-brand/20' }, { i: <GitBranch size={26} />, t: 'Supply-chain truth', d: 'Location · quantity · temperature · expiry — every hand-off signed.', c: 'from-ok/20' }].flatMap((x, i) => [
            <motion.div key={x.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className={`glass rounded-3xl bg-gradient-to-b ${x.c} to-transparent p-7`}><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">{x.i}</div><h3 className="mt-5 text-xl font-semibold text-white">{x.t}</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">{x.d}</p></motion.div>,
            ...(i < 2 ? [<div key={'e' + i} className="hidden justify-center text-slate-500 lg:flex"><Equal size={22} /></div>] : []),
          ])}
        </div>

        <div className="glass mt-14 overflow-hidden rounded-3xl">
          <div className="grid lg:grid-cols-2">
            <div className="p-8"><div className="label text-bad">Why QR alone is not enough</div><h3 className="mt-3 text-2xl font-bold text-white">A copied QR still points to a real record.</h3><p className="mt-3 text-sm leading-relaxed text-slate-400">An attacker photographs a genuine code and prints it on counterfeit packaging. The ledger lookup succeeds — so a QR-only system says “authentic”. FoodChain Guard keeps going:</p></div>
            <div className="border-t border-white/5 bg-ink-950/40 p-8 lg:border-l lg:border-t-0">
              {[['QR identity', 'VALID', true], ['Packaging fingerprint', 'MISMATCH', false], ['Scan locations', 'Mumbai · Delhi · Pune · Bengaluru', false]].map(([l, v, ok]) => <div key={l as string} className="flex items-center justify-between border-b border-white/5 py-3 text-sm last:border-0"><span className="text-slate-300">{l as string}</span><span className={`flex items-center gap-2 font-semibold ${ok ? 'text-ok' : 'text-bad'}`}>{ok ? <Check size={16} /> : <X size={16} />}{v as string}</span></div>)}
              <div className="mt-4 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm font-bold text-bad">⚠ Possible counterfeit / QR replay attack</div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-y border-white/5 bg-ink-900/40 py-24">
        <div className="mx-auto max-w-6xl px-6"><div className="text-center"><div className="label text-brand">Journey</div><h2 className="mt-3 text-4xl font-bold tracking-tight text-white">Every hand-off is a signed block.</h2></div>
          <div className="mt-14 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[['🌱', 'Farm', 'Harvest registered, identity issued'], ['🏭', 'Processing', 'Packaging fingerprint & watermark sealed'], ['🚚', 'Distributor', 'Route, quantity & custody signed'], ['❄️', 'Warehouse', 'Cold-chain telemetry anchored'], ['🛒', 'Retailer', 'Shelf stock & scans verified'], ['👤', 'Consumer', 'Scan → plain-language proof']].map(([e, t, d], i) => (
              <motion.div key={t} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="glass relative rounded-2xl p-5 text-center"><div className="text-4xl">{e}</div><div className="mt-3 text-[15px] font-semibold text-white">{t}</div><div className="mt-1 text-xs leading-relaxed text-slate-400">{d}</div><div className="mono mt-3 text-[10px] text-slate-600">block #{i + 1}</div></motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="layers" className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center"><div className="label text-brand">Defence in depth</div><h2 className="mt-3 text-4xl font-bold tracking-tight text-white">Why each layer exists</h2></div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {[
            { i: <Link2 />, t: 'Blockchain / hash chain', d: 'History becomes tamper-evident: editing one block changes its hash and invalidates every block after it. The ledger holds proofs — never raw business data.' },
            { i: <Lock />, t: 'Cryptography', d: 'Sensitive metadata stays AES-256 encrypted off-chain. Only SHA-256 digests and ECDSA signatures are public, so anyone can verify and no one can read.' },
            { i: <Eye />, t: 'Computer vision', d: 'Reads the physical package: logo geometry, typography, colour, layout, micro-pattern and watermark — so a copied QR on fake packaging is caught.' },
            { i: <Brain />, t: 'ML anomaly detection', d: 'Finds what rules can’t: QR replay, impossible travel, vanishing quantities and temperature excursions — each with confidence and evidence.' },
          ].map((x) => <div key={x.t} className="glass flex gap-5 rounded-2xl p-6"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">{x.i}</span><div><h3 className="text-lg font-semibold text-white">{x.t}</h3><p className="mt-1.5 text-sm leading-relaxed text-slate-400">{x.d}</p></div></div>)}
        </div>
        <div className="mt-16 rounded-3xl border border-brand/20 bg-gradient-to-br from-brand/10 via-transparent to-ok/10 p-10 text-center">
          <h3 className="text-3xl font-bold text-white">See an attack get caught.</h3><p className="mx-auto mt-3 max-w-xl text-slate-400">Load the security demo, then trigger a counterfeit package, a QR replay or a tampered ledger — and watch every screen respond.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><Btn variant="primary" size="lg" icon={<Play size={16} />} onClick={runDemo}>Run Security Demo</Btn><Btn size="lg" onClick={() => navigate('/login')}>Choose a role</Btn></div>
        </div>
      </section>
      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">FoodChain Guard · prototype · simulated blockchain, cryptography, IoT and ML for demonstration · “Trust Every Bite.” <Sprout size={12} className="ml-1 inline text-ok" /><Hash size={12} className="ml-1 inline" /><QrCode size={12} className="ml-1 inline" /></footer>
    </div>
  )
}
