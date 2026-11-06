import { Download, RotateCcw, ShieldCheck } from 'lucide-react'
import { Btn, Card, Field, Kv, PageHeader, Badge } from '../../components/ui'
import { useStore } from '../../state/store'
import { DEFAULT_SETTINGS } from '../../models/types'
import { ROLES } from '../../data/roles'
import { publicKeyFor } from '../../services/crypto'
import { downloadText } from '../../utils/format'

export function SettingsPage() {
  const { settings, set, role, setRole, reset, demoLoaded, loadDemo, toast } = useStore((s) => ({ settings: s.settings, set: s.setSettings, role: s.role, setRole: s.setRole, reset: s.resetData, demoLoaded: s.demoLoaded, loadDemo: s.loadDemo, toast: s.toast }))
  const num = (k: keyof typeof settings, step = 1) => <input type="number" step={step} className="input" value={settings[k] as number} onChange={(e) => set({ [k]: +e.target.value })} />
  return (
    <>
      <PageHeader eyebrow="Settings" title="Platform settings" subtitle="Detection thresholds feed the anomaly engine live — change one and watch the dashboards respond." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Detection thresholds" right={<Btn size="sm" icon={<RotateCcw size={13} />} onClick={() => set(DEFAULT_SETTINGS)}>Defaults</Btn>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Safe temperature min (°C)">{num('minTempC', 0.5)}</Field><Field label="Safe temperature max (°C)">{num('maxTempC', 0.5)}</Field>
            <Field label="Quantity tolerance (%)" hint="Hand-off drops above this are flagged">{num('quantityTolerancePct', 0.5)}</Field>
            <Field label="Max plausible speed (km/h)" hint="Impossible-travel threshold">{num('maxPlausibleKmh', 5)}</Field>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-3 text-[13px] text-slate-200"><input type="checkbox" className="accent-cyan-400" checked={settings.autoBlockCritical} onChange={(e) => set({ autoBlockCritical: e.target.checked })} />Auto-block batches on CRITICAL incidents</label>
        </Card>
        <Card title="Cryptography & keys" icon={<ShieldCheck size={14} className="text-ok" />}>
          <Kv k="Data-at-rest encryption" v="AES-256-GCM (simulated)" /><Kv k="Integrity hash" v="SHA-256" /><Kv k="Signatures" v="ECDSA P-256 (simulated)" /><Kv k="Master key" v={<span className="mono">kms/fcg-master-01</span>} /><Kv k="Platform public key" v={<span className="mono text-[11px]">{publicKeyFor('fcg-platform').slice(0, 34)}…</span>} />
          <p className="mt-3 text-xs leading-relaxed text-slate-500">Prototype: primitives are deterministic simulations with the same structure as production (WebCrypto / HSM-backed keys). Sensitive data is never written to the ledger — only digests and signatures.</p>
        </Card>
        <Card title="Demo data">
          <div className="flex flex-wrap items-center gap-3"><Badge tone={demoLoaded ? 'ok' : 'warn'} dot>{demoLoaded ? 'Security demo loaded' : 'Baseline data'}</Badge>
            {!demoLoaded && <Btn variant="primary" onClick={loadDemo}>Load security demo</Btn>}
            <Btn icon={<RotateCcw size={14} />} onClick={reset}>Reset to baseline</Btn>
            <Btn icon={<Download size={14} />} onClick={() => { const s = useStore.getState(); downloadText('foodchain-state.json', JSON.stringify({ batches: s.batches, events: s.events, incidents: s.incidents }, null, 1)); toast('State exported', 'ok') }}>Export state JSON</Btn></div>
        </Card>
        <Card title="Role (demo switcher)">
          <div className="grid grid-cols-2 gap-2">{ROLES.map((r) => <button key={r.id} onClick={() => setRole(r.id)} className={`rounded-xl border px-3 py-2 text-left text-xs ${role === r.id ? 'border-brand/50 bg-brand/10 text-white' : 'border-line text-slate-400 hover:bg-white/5'}`}><div className="font-semibold">{r.label}</div><div className="text-[10.5px] text-slate-500">{r.actorName ?? 'network-wide'}</div></button>)}</div>
        </Card>
      </div>
    </>
  )
}
