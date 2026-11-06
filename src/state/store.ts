import { create } from 'zustand'
import type {
  AuditEntry, Batch, ChainEvent, Incident, IncidentStatus, Notification, PackageMods, Pkg, QrScan, RecallRecord, Role, Settings,
} from '../models/types'
import { DEFAULT_SETTINGS, NO_MODS } from '../models/types'
import { getBaseData, getDemoData, pristine, type DataState } from '../data/seed'
import { ACTORS, ACTOR_BY_ID, PRODUCTS } from '../data/catalog'
import { HERO_BATCH } from '../services/incidents'
import { runScenario, resolveOpenForBatch, type ScenarioId, type ScenarioOpts } from '../services/scenarios'
import { GENESIS_HASH, rebuildChain, sealEvent, tamperEvent } from '../services/ledger'
import { encryptRecord, sensitiveMetaFor } from '../services/crypto'
import { sha256 } from '../utils/sha256'
import { DAY, HOUR, MIN, NOW } from '../utils/clock'
import { raiseForTamper } from './tamper'
import { analysisFor } from '../services/analysisCache'

export interface ScenarioLogEntry { ts: number; id: ScenarioId | string; message: string; incidentId?: string }
export interface SafetyEntry { ts: number; batchId: string; label: string; before: number; after: number; trustBefore: number; trustAfter: number }
export interface Toast { id: number; text: string; tone: 'ok' | 'bad' | 'warn' | 'info' }

export interface RegisterForm {
  productIdx: number
  farmId: string
  harvestDate: number
  processingDate: number
  expiryDate: number
  quantity: number
  certification: string
  storageMin: number
  storageMax: number
  humidityMin: number
  humidityMax: number
}

interface UiState {
  role: Role
  selectedBatchId: string
  settings: Settings
  backups: Record<string, ChainEvent[]>
  scenarioLog: ScenarioLogEntry[]
  safetyLog: SafetyEntry[]
  toasts: Toast[]
  assistantSeed: string | null
}

interface Actions {
  setRole: (r: Role) => void
  selectBatch: (id: string) => void
  loadDemo: () => void
  resetData: () => void
  setSettings: (p: Partial<Settings>) => void
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
  markNotificationsRead: () => void
  pushNotification: (n: Omit<Notification, 'id' | 'ts' | 'read'>) => void
  logAudit: (a: Omit<AuditEntry, 'id' | 'ts' | 'hash'>) => void
  logScan: (qrId: string, city: string, minutesAgo?: number) => void
  runScenario: (id: ScenarioId, batchId?: string, opts?: ScenarioOpts) => { message: string; incidentId?: string }
  tamperBlock: (batchId: string, index: number, change: { quantity?: number; timestamp?: number }, recompute: boolean) => void
  restoreChain: (batchId: string) => void
  incidentAction: (id: string, action: 'resolve' | 'escalate' | 'block' | 'unblock' | 'investigate') => void
  blockBatch: (batchId: string, on: boolean) => void
  startRecall: (batchId: string, reason: string) => void
  recallProgress: (batchId: string, nodeId: string) => void
  completeRecall: (batchId: string) => void
  cancelRecall: (batchId: string) => void
  revokeQr: (qrId: string) => void
  setPackageMods: (packageId: string, mods: Partial<PackageMods>) => void
  resetTelemetry: (batchId: string) => void
  registerBatch: (f: RegisterForm) => Batch
  setAssistantSeed: (q: string | null) => void
}

export type Store = DataState & UiState & Actions

const LS_KEY = 'fcg.v1'
function readLS(): { role?: Role; selectedBatchId?: string; demoLoaded?: boolean; settings?: Settings } {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function writeLS(s: Store) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ role: s.role, selectedBatchId: s.selectedBatchId, demoLoaded: s.demoLoaded, settings: s.settings }))
  } catch { /* storage unavailable */ }
}

const ls = readLS()
const initial = ls.demoLoaded ? getDemoData() : getBaseData()
let toastSeq = 1

export const useStore = create<Store>((set, get) => ({
  ...initial,
  role: ls.role ?? 'admin',
  selectedBatchId: ls.selectedBatchId ?? HERO_BATCH,
  settings: { ...DEFAULT_SETTINGS, ...(ls.settings ?? {}) },
  backups: {},
  scenarioLog: [],
  safetyLog: [],
  toasts: [],
  assistantSeed: null,

  setRole: (role) => set({ role }),
  selectBatch: (id) => set({ selectedBatchId: id }),
  setAssistantSeed: (q) => set({ assistantSeed: q }),

  loadDemo: () => {
    set({ ...getDemoData(), backups: {}, scenarioLog: [], safetyLog: [], selectedBatchId: HERO_BATCH })
    get().toast('Security demo loaded — 30 batches, 125 ledger blocks, 6 live incidents', 'ok')
  },
  resetData: () => {
    set({ ...getBaseData(), backups: {}, scenarioLog: [], safetyLog: [] })
    get().toast('Data reset to the baseline (no live incidents)', 'info')
  },
  setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

  toast: (text, tone = 'info') => {
    const id = toastSeq++
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }))
    setTimeout(() => get().dismissToast(id), 4200)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  markNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  pushNotification: (n) =>
    set((s) => ({ notifications: [{ id: `N-${s.notifications.length + 1}-${n.title.length}`, ts: NOW, read: false, ...n }, ...s.notifications] })),
  logAudit: (a) =>
    set((s) => ({ audit: [{ id: `A-${s.audit.length + 1}`, ts: NOW, hash: sha256(JSON.stringify(a) + s.audit.length), ...a }, ...s.audit] })),

  logScan: (qrId, city, minutesAgo = 0) =>
    set((s) => {
      const pk = s.packages.find((p) => p.qrId === qrId)
      if (!pk) return {}
      const scan: QrScan = { scanId: `SCN-U-${s.scans.length + 1}`, qrId, batchId: pk.batchId, city, timestamp: NOW - minutesAgo * MIN, source: 'analyst' }
      return { scans: [...s.scans, scan] }
    }),

  runScenario: (id, batchId, opts) => {
    const s = get()
    const target = batchId ?? s.selectedBatchId
    const engine = (x: Store | DataState) => analysisFor({ batches: x.batches, packages: x.packages, events: x.events, scans: x.scans, telemetry: x.telemetry, settings: s.settings })
    const beforeA = engine(s).byId[target]
    const res = runScenario(id, s, target, s.settings, opts)
    const { data, backup } = res
    const patch: Partial<Store> = {
      batches: data.batches, packages: data.packages, events: data.events, scans: data.scans, telemetry: data.telemetry,
      incidents: data.incidents, notifications: data.notifications, audit: data.audit,
      scenarioLog: [{ ts: NOW, id, message: res.message, incidentId: res.incidentId }, ...s.scenarioLog].slice(0, 30),
    }
    const afterA = engine(data).byId[target]
    if (beforeA && afterA && (beforeA.scores.foodSafety !== afterA.scores.foodSafety || beforeA.trust.trust !== afterA.trust.trust)) {
      patch.safetyLog = [{ ts: NOW, batchId: target, label: res.message, before: beforeA.scores.foodSafety, after: afterA.scores.foodSafety, trustBefore: beforeA.trust.trust, trustAfter: afterA.trust.trust }, ...s.safetyLog].slice(0, 40)
    }
    if (backup && !s.backups[target]) patch.backups = { ...s.backups, [target]: backup }
    if (id === 'authentic') patch.backups = { ...s.backups, [target]: undefined as unknown as ChainEvent[] }
    set(patch)
    get().toast(res.message, id === 'authentic' ? 'ok' : 'bad')
    return { message: res.message, incidentId: res.incidentId }
  },

  tamperBlock: (batchId, index, change, recompute) => {
    const s = get()
    const evs = s.events.filter((e) => e.batchId === batchId).sort((a, b) => a.index - b.index)
    if (!evs[index]) return
    const backups = s.backups[batchId] ? s.backups : { ...s.backups, [batchId]: evs }
    const tampered = tamperEvent(evs, index, change, recompute)
    const events = s.events.filter((e) => e.batchId !== batchId).concat(tampered)
    const incidents = raiseForTamper(s.incidents, batchId, index, evs[index], tampered[index], tampered.length, s.settings)
    const notifications = incidents.length !== s.incidents.length
      ? [{ id: `N-T-${s.notifications.length}`, ts: NOW, level: 'critical' as const, title: 'Ledger tampering detected', body: `${batchId}: block #${index + 1} invalid, downstream hashes invalid.`, batchId, read: false }, ...s.notifications]
      : s.notifications
    set({ events, backups, incidents, notifications })
    get().logAudit({ actor: 'Hash-chain Validator', batchId, action: `BLOCK #${index + 1} MODIFIED`, location: evs[index].location, status: 'INVALID' })
    get().toast(`Block #${index + 1} modified — validating the chain will fail`, 'bad')
  },

  restoreChain: (batchId) => {
    const s = get()
    const original = s.backups[batchId]
    if (!original) { get().toast('Nothing to restore for this batch', 'info'); return }
    const events = s.events.filter((e) => e.batchId !== batchId).concat(original)
    const incidents = resolveOpenForBatch({ ...s, events } as DataState, batchId, ['LEDGER_TAMPERING'], 'Original block restored from immutable replica').incidents
    const backups = { ...s.backups }
    delete backups[batchId]
    set({ events, incidents, backups })
    get().pushNotification({ level: 'success', title: 'Ledger restored', body: `${batchId}: original block restored, chain valid.`, batchId })
    get().logAudit({ actor: 'Ledger Recovery', batchId, action: 'BLOCK RESTORED FROM REPLICA', location: '—', status: 'VALID' })
    get().toast('Original block restored — chain verified', 'ok')
  },

  incidentAction: (id, action) => {
    const s = get()
    const inc = s.incidents.find((i) => i.incidentId === id)
    if (!inc) return
    const map: Record<string, { status: IncidentStatus; text: string }> = {
      resolve: { status: 'RESOLVED', text: 'Marked resolved by analyst' },
      escalate: { status: 'ESCALATED', text: 'Escalated to Head of Security & regulator liaison' },
      block: { status: 'CONTAINED', text: 'Batch blocked network-wide; distribution halted' },
      unblock: { status: 'INVESTIGATING', text: 'Batch hold lifted; investigation resumed' },
      investigate: { status: 'INVESTIGATING', text: 'Investigation started' },
    }
    const m = map[action]
    let batches = s.batches
    if (action === 'block') batches = batches.map((b) => (b.batchId === inc.batchId ? { ...b, hold: 'BLOCKED' as const } : b))
    if (action === 'unblock') batches = batches.map((b) => (b.batchId === inc.batchId && b.hold === 'BLOCKED' ? { ...b, hold: 'NONE' as const } : b))
    set({
      batches,
      incidents: s.incidents.map((i) => (i.incidentId === id ? { ...i, status: m.status, timeline: [...i.timeline, { t: NOW, text: m.text }] } : i)),
    })
    get().logAudit({ actor: 'Security Analyst', batchId: inc.batchId, action: `INCIDENT ${id}: ${action.toUpperCase()}`, location: inc.location, status: 'VALID' })
    get().toast(`${id}: ${m.text}`, action === 'resolve' ? 'ok' : 'warn')
  },

  blockBatch: (batchId, on) => {
    set((s) => ({ batches: s.batches.map((b) => (b.batchId === batchId ? { ...b, hold: on ? 'BLOCKED' : 'NONE' } : b)) }))
    get().logAudit({ actor: 'Security Analyst', batchId, action: on ? 'BATCH BLOCKED' : 'BATCH UNBLOCKED', location: '—', status: 'VALID' })
    get().toast(on ? `${batchId} blocked across the network` : `${batchId} hold lifted`, on ? 'warn' : 'ok')
  },

  startRecall: (batchId, reason) => {
    const rec: RecallRecord = { batchId, initiatedAt: NOW, reason, notified: [], status: 'IN_PROGRESS' }
    set((s) => ({
      recalls: { ...s.recalls, [batchId]: rec },
      batches: s.batches.map((b) => (b.batchId === batchId ? { ...b, hold: 'RECALLED' as const } : b)),
    }))
    get().pushNotification({ level: 'critical', title: `Recall initiated for ${batchId}`, body: reason, batchId })
    get().logAudit({ actor: 'Recall Center', batchId, action: 'RECALL INITIATED', location: 'Network', status: 'FLAGGED' })
  },
  recallProgress: (batchId, nodeId) =>
    set((s) => {
      const r = s.recalls[batchId]
      if (!r || r.notified.includes(nodeId)) return {}
      return { recalls: { ...s.recalls, [batchId]: { ...r, notified: [...r.notified, nodeId] } } }
    }),
  completeRecall: (batchId) => {
    set((s) => ({ recalls: s.recalls[batchId] ? { ...s.recalls, [batchId]: { ...s.recalls[batchId], status: 'COMPLETE' } } : s.recalls }))
    get().pushNotification({ level: 'success', title: 'Recall propagation complete', body: `All custodians of ${batchId} acknowledged the recall.`, batchId })
  },
  cancelRecall: (batchId) =>
    set((s) => {
      const recalls = { ...s.recalls }
      delete recalls[batchId]
      return { recalls, batches: s.batches.map((b) => (b.batchId === batchId && b.hold === 'RECALLED' ? { ...b, hold: 'NONE' as const } : b)) }
    }),

  revokeQr: (qrId) => {
    set((s) => ({ packages: s.packages.map((p) => (p.qrId === qrId ? { ...p, qrRevoked: true } : p)) }))
    get().toast(`${qrId} revoked`, 'warn')
  },

  resetTelemetry: (batchId) => {
    const p = pristine(batchId)
    if (!p) return
    set((s) => ({ telemetry: { ...s.telemetry, [batchId]: p.telemetry } }))
    get().toast('Sensor telemetry restored to baseline', 'ok')
  },
  setPackageMods: (packageId, mods) =>
    set((s) => ({ packages: s.packages.map((p) => (p.packageId === packageId ? { ...p, mods: { ...p.mods, ...mods } } : p)) })),

  registerBatch: (f) => {
    const s = get()
    const spec = PRODUCTS[f.productIdx]
    const farm = ACTOR_BY_ID[f.farmId]
    const maxNo = Math.max(...s.batches.map((b) => parseInt(b.batchId.slice(-5), 10)))
    const batchId = `FCG-2026-${String(maxNo + 1).padStart(5, '0')}`
    const fp = 'PF-' + sha256('pf' + batchId).slice(0, 10).toUpperCase()
    const wm = 'WM-' + sha256('wm' + batchId).slice(0, 8).toUpperCase()
    const batch: Batch = {
      batchId, product: spec.product, variety: spec.variety, emoji: spec.emoji, unit: spec.unit,
      quantity: f.quantity, packageCount: spec.unit === 'kg' ? Math.round(f.quantity / 0.5) : f.quantity,
      farmId: farm.id, farm: farm.name, origin: `${farm.city}, Maharashtra`,
      harvestDate: f.harvestDate, processingDate: f.processingDate, expiryDate: f.expiryDate,
      certification: f.certification, certId: `${f.certification.slice(0, 3).toUpperCase()}-IN-${parseInt(sha256(batchId).slice(0, 5), 16) % 900000 + 100000}`, certValid: true,
      qrId: '', packagingFingerprint: fp, watermarkId: wm,
      route: { processorId: 'proc-1', distributorId: 'dist-1', warehouseId: 'wh-1', retailerId: 'ret-1' },
      storage: { minC: f.storageMin, maxC: f.storageMax, humidityMin: f.humidityMin, humidityMax: f.humidityMax },
      hold: 'NONE', brand: spec.brand, createdAt: NOW,
    }
    const pkgs: Pkg[] = [0, 1].map((i) => ({
      packageId: `PKG-${batchId.slice(-5)}-${'AB'[i]}`, batchId,
      qrId: `QR-FCG-${(parseInt(sha256(batchId + i).slice(0, 6), 16) % 900000) + 100000}`,
      fingerprint: fp, watermarkId: wm, mods: { ...NO_MODS }, qrRevoked: false,
    }))
    batch.qrId = pkgs[0].qrId
    const base = {
      eventId: `EVT-${batchId.slice(-5)}-1`, batchId, index: 0, actorId: farm.id, actor: farm.name, actorType: farm.type,
      location: farm.city, timestamp: Math.min(f.harvestDate, NOW), action: 'HARVESTED' as const,
      quantity: f.quantity, unit: spec.unit, temperatureC: 27.4, payloadDigest: '', previousHash: GENESIS_HASH,
    }
    const genesis = sealEvent({ ...base, payloadDigest: encryptRecord(sensitiveMetaFor(batch, base)).digest })
    const tel = Array.from({ length: 96 }, (_, i) => ({ t: NOW - (95 - i) * 15 * MIN, tempC: +(5 + Math.sin(i / 8) * 0.6).toFixed(1), humidity: 84 }))
    set({
      batches: [batch, ...s.batches], packages: [...s.packages, ...pkgs], events: [...s.events, genesis],
      telemetry: { ...s.telemetry, [batchId]: tel }, selectedBatchId: batchId,
    })
    get().logAudit({ actor: farm.name, batchId, action: 'BATCH REGISTERED · GENESIS BLOCK', location: farm.city, status: 'VALID' })
    get().pushNotification({ level: 'success', title: `Batch ${batchId} registered`, body: 'Genesis block sealed, QR identity and packaging fingerprint issued.', batchId })
    return batch
  },
}))

useStore.subscribe((s) => writeLS(s))

export { rebuildChain }

// Exposed for debugging / automated demo checks.
if (typeof window !== 'undefined') (window as unknown as { __fcg: typeof useStore }).__fcg = useStore
