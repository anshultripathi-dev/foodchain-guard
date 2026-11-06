import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Factory, FlaskConical, ShieldCheck, ShieldAlert, Sprout, Store, Truck, User, Warehouse, Zap, Crown } from 'lucide-react'
import { ROLES } from '../data/roles'
import { useStore } from '../state/store'
import { navigate, Link } from '../utils/router'
import { Btn } from '../components/ui'
import type { Role } from '../models/types'

const ICON: Record<Role, JSX.Element> = {
  admin: <Crown size={22} />, farmer: <Sprout size={22} />, processor: <Factory size={22} />, distributor: <Truck size={22} />,
  warehouse: <Warehouse size={22} />, retailer: <Store size={22} />, consumer: <User size={22} />, analyst: <ShieldAlert size={22} />,
}

export function RoleSelect() {
  const { setRole, loadDemo } = useStore((s) => ({ setRole: s.setRole, loadDemo: s.loadDemo }))
  return (
    <div className="min-h-screen bg-aurora px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> Back</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-ok text-ink-950"><ShieldCheck size={21} /></span><span className="text-lg font-bold text-white">FoodChain Guard</span></div>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white">Choose how you’ll use the platform</h1>
            <p className="mt-2 max-w-xl text-slate-400">Role-based interfaces share one data set. This prototype uses a role switcher instead of real sign-in — you can change roles any time from the top bar.</p></div>
          <Btn variant="primary" size="lg" icon={<Zap size={17} />} onClick={() => { setRole('admin'); loadDemo(); navigate('/app/overview') }}>Launch Demo Environment</Btn>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r, i) => (
            <motion.button key={r.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -4 }} onClick={() => { setRole(r.id); navigate(r.home) }} className="glass group relative overflow-hidden rounded-2xl p-5 text-left">
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-25 blur-2xl transition group-hover:opacity-50" style={{ background: r.accent }} />
              <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: r.accent + '22', color: r.accent }}>{ICON[r.id]}</span>
              <h3 className="mt-4 text-[16px] font-semibold text-white">{r.label}</h3>
              <p className="mt-1 min-h-[54px] text-[12.5px] leading-relaxed text-slate-400">{r.blurb}</p>
              {r.actorName && <div className="mt-2 text-[11px] text-slate-500">as {r.actorName}</div>}
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold" style={{ color: r.accent }}>{r.id === 'consumer' ? 'Open shopper app' : 'Enter workspace'} <ArrowRight size={13} className="transition group-hover:translate-x-1" /></div>
            </motion.button>
          ))}
        </div>
        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-vio/25 bg-vio/[0.07] px-5 py-4 text-sm text-slate-300"><FlaskConical className="text-vio" size={20} />Tip: <b className="text-white">Launch Demo Environment</b> loads 30 batches, 125 ledger blocks and live incidents, then opens the executive dashboard. The Demo Lab has a guided 40-step path.</div>
      </div>
    </div>
  )
}
