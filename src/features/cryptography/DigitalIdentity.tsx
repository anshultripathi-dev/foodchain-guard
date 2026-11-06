import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown, BadgeCheck, Database, Eye, EyeOff, FileKey, Fingerprint, Link2, Lock, Play, ShieldCheck, ShieldX } from 'lucide-react'
import { Badge, Btn, Card, HashText, Kv, PageHeader, Tabs, Check2 } from '../../components/ui'
import { useStore } from '../../state/store'
import { useSelectedAnalysis, useAnalysis } from '../../state/selectors'
import { identityValid } from '../../services/identity'
import { aesEncryptSim, aesDecryptSim, encryptRecord, sensitiveMetaFor, signSim, verifySim, type SensitiveMeta } from '../../services/crypto'
import { sha256 } from '../../utils/sha256'
import { fmtDateTime, cn } from '../../utils/format'
import { qrMatrix } from '../../utils/packageArt'
import { navigate } from '../../utils/router'
import { ACTOR_BY_ID } from '../../data/catalog'

function QrCanvas({ id, size = 150 }: { id: string; size?: number }) {
  const m = useMemo(() => qrMatrix(id), [id])
  const c = size / m.length
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-lg bg-white p-1.5">
      {m.map((row, y) => row.map((v, x) => v && <rect key={`${x}-${y}`} x={x * c} y={y * c} width={c + 0.3} height={c + 0.3} fill="#0b1220" />))}
    </svg>
  )
}

function IdentityView() {
  const a = useSelectedAnalysis()
  const revoke = useStore((s) => s.revokeQr)
  const role = useStore((s) => s.role)
  const b = a.batch
  const idv = useMemo(() => identityValid(b, a.events[0]?.timestamp ?? b.createdAt), [b, a.events])
  const id = idv.current
  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={cn('relative overflow-hidden rounded-3xl border p-6', idv.valid ? 'border-brand/30' : 'border-bad/50')} style={{ background: 'linear-gradient(135deg,#0f1f3d 0%,#0b1325 55%,#101b36 100%)' }}>
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-brand/20 blur-3xl" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-brand"><Fingerprint size={15} /> FoodChain Guard · Digital ID</div>
            {idv.valid ? <Badge tone="ok" dot>VALID</Badge> : <Badge tone="bad" dot>INVALID</Badge>}
          </div>
          <div className="mt-5 flex gap-5">
            <QrCanvas id={b.qrId} />
            <div className="min-w-0 flex-1">
              <div className="text-3xl">{b.emoji}</div>
              <div className="mt-1 text-lg font-bold leading-tight text-white">{b.product}</div>
              <div className="mono mt-1 text-[12px] text-brand">{b.batchId}</div>
              <div className="mt-2 text-xs text-slate-400">{b.origin}</div>
            </div>
          </div>
          <div className="mono mt-5 space-y-1 text-[11px] text-slate-400">
            <div>SHA-256 {id.hash.slice(0, 32).toUpperCase()}…</div>
            <div>SIG {id.signature.slice(0, 32).toUpperCase()}…</div>
          </div>
        </motion.div>
        <div className={cn('mt-4 flex items-center gap-3 rounded-2xl border px-5 py-3.5 text-[14px] font-semibold', idv.valid ? 'border-ok/30 bg-ok/10 text-ok' : 'border-bad/40 bg-bad/10 text-bad')}>
          {idv.valid ? <BadgeCheck size={20} /> : <ShieldX size={20} />}
          {idv.valid ? 'Digital identity valid.' : 'Digital identity INVALID — registered record no longer matches.'}
        </div>
        {!idv.valid && <p className="mt-2 text-xs text-slate-400">The identity hash covers product, origin, quantity, certificate and QR / fingerprint / watermark IDs. A changed certificate or quantity breaks the signature recorded at registration.</p>}
      </div>

      <div className="space-y-5">
        <Card title="Identity record" subtitle="Everything a verifier can check without seeing private data">
          <Kv k="Batch ID" v={<span className="mono">{id.batchId}</span>} />
          <Kv k="Product ID" v={<span className="mono">{id.productId}</span>} />
          <Kv k="QR ID" v={<span className="mono">{id.qrId}</span>} />
          <Kv k="Packaging fingerprint" v={<span className="mono">{id.fingerprint}</span>} />
          <Kv k="SHA-256 hash" v={<HashText hash={id.hash} n={20} label="SHA-256 hash" />} />
          <Kv k="Digital signature (ECDSA, simulated)" v={<HashText hash={id.signature} n={16} label="Signature" />} />
          <Kv k="Signer" v={ACTOR_BY_ID[id.signerId]?.name ?? id.signerId} />
          <Kv k="Creation timestamp" v={fmtDateTime(id.createdAt)} />
          <Kv k="Hash matches registry" v={<Check2 ok={idv.hashOk} label={idv.hashOk ? 'match' : 'MISMATCH'} />} />
          <Kv k="Signature verifies" v={<Check2 ok={idv.sigOk} label={idv.sigOk ? 'verified' : 'FAILED'} />} />
        </Card>
        <Card title="Package identities" subtitle="Each physical unit carries its own QR bound to this batch">
          <table className="tbl">
            <thead><tr><th>Package</th><th>QR ID</th><th>Fingerprint</th><th>Watermark</th><th>Status</th><th /></tr></thead>
            <tbody>
              {a.packages.map((p) => (
                <tr key={p.packageId}>
                  <td className="mono text-[12px]">{p.packageId}</td><td className="mono text-[12px] text-brand">{p.qrId}</td>
                  <td className="mono text-[12px]">{p.fingerprint}</td><td className="mono text-[12px]">{p.watermarkId}</td>
                  <td>{p.qrRevoked ? <Badge tone="bad">REVOKED</Badge> : <Badge tone="ok" dot>ACTIVE</Badge>}</td>
                  <td className="text-right">{(role === 'admin' || role === 'analyst') && !p.qrRevoked && <Btn size="sm" variant="danger" onClick={() => revoke(p.qrId)}>Revoke</Btn>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

const STEP_META = [
  { k: 'raw', title: 'Raw metadata', icon: <FileKey size={16} />, tone: 'text-slate-300' },
  { k: 'aes', title: 'AES-256 encryption', icon: <Lock size={16} />, tone: 'text-vio' },
  { k: 'enc', title: 'Encrypted record', icon: <Database size={16} />, tone: 'text-vio' },
  { k: 'hash', title: 'SHA-256 integrity hash', icon: <Fingerprint size={16} />, tone: 'text-brand' },
  { k: 'sig', title: 'Digital signature', icon: <BadgeCheck size={16} />, tone: 'text-warn' },
  { k: 'ledger', title: 'Ledger event', icon: <Link2 size={16} />, tone: 'text-ok' },
] as const

function Diff({ a, b }: { a: string; b: string }) {
  return <span className="mono break-all text-[12px]">{b.split('').map((ch, i) => <span key={i} className={ch !== a[i] ? 'rounded bg-bad/30 text-bad' : 'text-slate-300'}>{ch}</span>)}</span>
}

function CryptoView() {
  const a = useSelectedAnalysis()
  const [idx, setIdx] = useState(Math.max(0, a.events.length - 1))
  useEffect(() => setIdx(Math.max(0, a.events.length - 1)), [a.batch.batchId])
  const ev = a.events[Math.min(idx, a.events.length - 1)]
  const meta = useMemo(() => sensitiveMetaFor(a.batch, ev), [a.batch, ev])
  const [raw, setRaw] = useState(JSON.stringify(meta, null, 2))
  useEffect(() => setRaw(JSON.stringify(meta, null, 2)), [meta])
  const [step, setStep] = useState(6)
  const [showSecret, setShowSecret] = useState(false)

  const original = useMemo(() => encryptRecord(meta), [meta])
  const compact = useMemo(() => { try { return JSON.stringify(JSON.parse(raw)) } catch { return raw } }, [raw])
  const enc = useMemo(() => aesEncryptSim(compact), [compact])
  const digest = sha256(enc.iv + enc.ciphertext + enc.tag)
  const matches = digest === ev.payloadDigest
  const sigOk = verifySim(ev.actorId, ev.currentHash, ev.signature)
  const decrypted = aesDecryptSim(enc)

  const run = () => { setStep(0); [1, 2, 3, 4, 5, 6].forEach((s, i) => setTimeout(() => setStep(s), (i + 1) * 700)) }
  const active = (i: number) => step > i

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="label">Ledger block</span>
        {a.events.map((e, i) => (
          <button key={e.eventId} onClick={() => setIdx(i)} className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold', i === idx ? 'border-brand/50 bg-brand/10 text-white' : 'border-line text-slate-400 hover:bg-white/5')}>#{i + 1} {e.action}</button>
        ))}
        <Btn variant="primary" size="sm" icon={<Play size={13} />} onClick={run}>Animate pipeline</Btn>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {STEP_META.map((s, i) => (
            <div key={s.k}>
              <motion.div animate={{ opacity: active(i) ? 1 : 0.35, scale: step === i + 1 ? 1.01 : 1 }} className={cn('glass rounded-2xl p-4', step === i + 1 && 'glass-hi')}>
                <div className="mb-2 flex items-center justify-between">
                  <div className={cn('flex items-center gap-2 text-[13px] font-semibold', s.tone)}>{s.icon}{i + 1}. {s.title}</div>
                  {s.k === 'aes' && <Badge tone="vio">AES-256-GCM · key kms/fcg-master-01</Badge>}
                  {s.k === 'hash' && <Badge tone={matches ? 'ok' : 'bad'} dot>{matches ? 'matches ledger digest' : 'DIFFERS from ledger digest'}</Badge>}
                  {s.k === 'sig' && <Badge tone={sigOk ? 'ok' : 'bad'} dot>{sigOk ? 'signature verifies' : 'INVALID'}</Badge>}
                </div>
                {s.k === 'raw' && (
                  <>
                    <textarea value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck={false} rows={8} className="input mono !text-[12px]" />
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500"><span>Edit any value — the downstream hash changes instantly (avalanche effect).</span><button className="text-brand hover:underline" onClick={() => setRaw(JSON.stringify(meta, null, 2))}>reset</button></div>
                  </>
                )}
                {s.k === 'aes' && <div className="text-xs text-slate-400">96-bit IV <span className="mono text-slate-200">{enc.iv}</span> · authentication tag <span className="mono text-slate-200">{enc.tag.slice(0, 16)}…</span> · decrypts back to plaintext: <span className={decrypted === compact ? 'text-ok' : 'text-bad'}>{decrypted === compact ? 'yes' : 'no'}</span></div>}
                {s.k === 'enc' && <div className="mono max-h-24 overflow-auto break-all text-[11.5px] leading-relaxed text-vio/90">{enc.ciphertext}</div>}
                {s.k === 'hash' && (
                  <div className="space-y-1.5 text-[12px]">
                    <div><span className="text-slate-500">computed </span>{matches ? <span className="mono break-all text-ok">{digest}</span> : <Diff a={ev.payloadDigest} b={digest} />}</div>
                    <div><span className="text-slate-500">ledger&nbsp;&nbsp; </span><span className="mono break-all text-slate-400">{ev.payloadDigest}</span></div>
                  </div>
                )}
                {s.k === 'sig' && <div className="text-xs text-slate-400">Signed by <b className="text-slate-200">{ev.actor}</b> over the block hash · <span className="mono">{ev.signature.slice(0, 40)}…</span></div>}
                {s.k === 'ledger' && (
                  <pre className="mono overflow-auto rounded-lg bg-ink-950/70 p-3 text-[11.5px] leading-relaxed text-slate-300">{JSON.stringify({ block: idx + 1, batchId: ev.batchId, action: ev.action, actor: ev.actorId, timestamp: ev.timestamp, quantity: ev.quantity, payloadDigest: ev.payloadDigest.slice(0, 24) + '…', previousHash: ev.previousHash.slice(0, 24) + '…', hash: ev.currentHash.slice(0, 24) + '…', signature: ev.signature.slice(0, 24) + '…' }, null, 2)}</pre>
                )}
              </motion.div>
              {i < STEP_META.length - 1 && <div className="flex justify-center py-1 text-slate-600"><ArrowDown size={16} /></div>}
            </div>
          ))}
        </div>

        <div className="space-y-5">
          <Card title="Cryptographic status">
            <Kv k="Encryption" v="AES-256" /><Kv k="Integrity" v="SHA-256" /><Kv k="Signature" v="ECDSA / simulated" />
            <Kv k="Status" v={matches && sigOk && a.chain.valid ? <Badge tone="ok" dot>VALID</Badge> : <Badge tone="bad" dot>{a.chain.valid ? 'DIGEST MISMATCH' : 'CHAIN COMPROMISED'}</Badge>} />
          </Card>
          <Card title="Where data lives" subtitle="Encrypted data is never put on the ledger">
            <div className="space-y-3">
              <div className="rounded-xl border border-vio/30 bg-vio/[0.06] p-3">
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-vio"><Lock size={14} /> Secure storage (off-chain)</div>
                <div className="mt-1 text-xs text-slate-400">Farmer contact, GPS, prices, lab reports, vehicle IDs — AES-256 encrypted, access-controlled.</div>
                <button className="mt-2 flex items-center gap-1.5 text-xs text-brand" onClick={() => setShowSecret(!showSecret)}>{showSecret ? <EyeOff size={13} /> : <Eye size={13} />} {showSecret ? 'Hide' : 'Reveal as authorised admin'}</button>
                {showSecret && <pre className="mono mt-2 overflow-auto rounded-lg bg-ink-950/70 p-2 text-[11px] text-slate-300">{JSON.stringify(meta as SensitiveMeta, null, 1)}</pre>}
              </div>
              <div className="rounded-xl border border-ok/30 bg-ok/[0.06] p-3">
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ok"><Link2 size={14} /> Public ledger (integrity proofs)</div>
                <div className="mt-1 text-xs text-slate-400">Only digests, hashes, signatures and non-sensitive event facts. Anyone can verify; nobody can read private data.</div>
              </div>
              <div className="rounded-xl border border-line p-3">
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-200"><ShieldCheck size={14} /> Consumers see</div>
                <div className="mt-1 text-xs text-slate-400">Product, origin, dates, safety score and verification result — never farmer or business details.</div>
              </div>
            </div>
          </Card>
          <Card title="Tamper evidence"><p className="text-xs leading-relaxed text-slate-400">Change one character in step 1: the ciphertext, digest and every downstream value change completely. The ledger still holds the original digest, so the mismatch is detected.</p>
            <Btn className="mt-3 w-full" onClick={() => navigate('/app/blockchain')}>Open hash-chain explorer</Btn></Card>
        </div>
      </div>
    </>
  )
}

export function DigitalIdentity({ initialTab = 'identity' }: { initialTab?: 'identity' | 'crypto' }) {
  const [tab, setTab] = useState(initialTab)
  const an = useAnalysis()
  const sel = useStore((s) => s.selectedBatchId)
  const select = useStore((s) => s.selectBatch)
  return (
    <>
      <PageHeader
        eyebrow="Digital identity & cryptography"
        title="Digital identity"
        subtitle="A cryptographically verifiable identity for every batch, with sensitive data kept encrypted and only integrity proofs on the ledger."
        actions={<select className="input mono !w-[290px]" value={sel} onChange={(e) => select(e.target.value)}>{an.list.map((x) => <option key={x.batch.batchId} value={x.batch.batchId}>{x.batch.batchId} · {x.batch.product}</option>)}</select>}
      />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'identity', label: <><Fingerprint size={14} />Digital identity</> }, { id: 'crypto', label: <><Lock size={14} />Cryptography dashboard</> }]} />
      {tab === 'identity' ? <IdentityView /> : <CryptoView />}
    </>
  )
}

export { signSim }
