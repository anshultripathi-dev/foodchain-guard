import type { EvidenceItem, Incident, IncidentStatus, Severity, ThreatType } from '../models/types'
import { HOUR, MIN } from '../utils/clock'
import { fmtDateTime } from '../utils/format'

export const HERO_BATCH = 'FCG-2026-00421'

const RESERVED: Partial<Record<ThreatType, number>> = {
  QR_REPLAY: 1042,
  COUNTERFEIT_PACKAGING: 1043,
  LEDGER_TAMPERING: 1044,
  QUANTITY_ANOMALY: 1045,
  COLD_CHAIN_VIOLATION: 1046,
  IMPOSSIBLE_TRAVEL: 1047,
  EXPIRED_PRODUCT: 1048,
  CERTIFICATION_TAMPERING: 1049,
}

export function nextIncidentId(existing: Incident[], type: ThreatType, batchId: string): string {
  const used = new Set(existing.map((i) => i.incidentId))
  const reserved = RESERVED[type]
  if (batchId === HERO_BATCH && reserved && !used.has(`SEC-${reserved}`)) return `SEC-${reserved}`
  let n = 1050
  while (used.has(`SEC-${n}`)) n++
  return `SEC-${n}`
}

interface Tpl {
  severity: Severity
  confidence: number
  detection: string
  description: (d: Details) => string
  recommended: string
}
export type Details = Record<string, string | number | undefined>

const T: Record<ThreatType, Tpl> = {
  QR_REPLAY: {
    severity: 'HIGH', confidence: 94, detection: 'AI Anomaly Engine · QR replay model',
    description: (d) => `Same package identity ${d.qrId ?? ''} observed across inconsistent locations (${d.cities ?? 'multiple cities'}).`,
    recommended: 'Block batch, revoke QR identity, and re-issue to verified packages only.',
  },
  COUNTERFEIT_PACKAGING: {
    severity: 'HIGH', confidence: 92, detection: 'Computer-vision Packaging Verifier',
    description: (d) => `Scanned package diverges from the registered packaging fingerprint (${d.similarity ?? '—'}% similarity). ${d.regions ?? ''}`,
    recommended: 'Quarantine suspect units, collect the physical sample, and notify the brand owner.',
  },
  LEDGER_TAMPERING: {
    severity: 'CRITICAL', confidence: 99, detection: 'Hash-chain Validator',
    description: (d) => `Block #${d.block ?? '?'} contents no longer match their signed hash; downstream hashes are invalid.`,
    recommended: 'Freeze the batch, restore the block from the immutable replica, and audit the writing node.',
  },
  QUANTITY_ANOMALY: {
    severity: 'MEDIUM', confidence: 88, detection: 'Quantity Reconciliation Engine',
    description: (d) => `${d.missing ?? '?'} ${d.unit ?? 'units'} unaccounted for between ${d.from ?? 'upstream'} and ${d.to ?? 'downstream'}.`,
    recommended: 'Reconcile with the custodian, request delivery proofs, and hold remaining stock.',
  },
  COLD_CHAIN_VIOLATION: {
    severity: 'HIGH', confidence: 97, detection: 'IoT Cold-chain Monitor',
    description: (d) => `Temperature reached ${d.peak ?? '?'}°C (safe ${d.range ?? '2–8°C'}) for ${d.minutes ?? '?'} minutes.`,
    recommended: 'Isolate the batch for lab testing and review the refrigeration unit logs.',
  },
  IMPOSSIBLE_TRAVEL: {
    severity: 'HIGH', confidence: 96, detection: 'Geo-velocity Engine',
    description: (d) => `Package scanned in ${d.from} and ${d.to} ${d.minutes} minutes apart (${d.km} km). Physically impossible.`,
    recommended: 'Treat as QR duplication / identity cloning; require physical re-verification.',
  },
  EXPIRED_PRODUCT: {
    severity: 'MEDIUM', confidence: 100, detection: 'Expiry Intelligence',
    description: (d) => `Product past its expiry date was scanned at ${d.location ?? 'retail'} (${d.days ?? '?'} day(s) overdue).`,
    recommended: 'Pull remaining stock from shelves and notify the retailer.',
  },
  UNAUTHORIZED_EVENT: {
    severity: 'HIGH', confidence: 91, detection: 'Actor Registry Validator',
    description: (d) => `Ledger event signed by unregistered handler ${d.actor ?? 'unknown'}.`,
    recommended: 'Investigate custody, suspend the signing key, and re-validate subsequent hand-offs.',
  },
  REPEATED_SCAN: {
    severity: 'LOW', confidence: 72, detection: 'Scan Behaviour Model',
    description: (d) => `Unusually many scans (${d.count ?? '?'}) of one QR within a short window in ${d.city ?? 'one city'}.`,
    recommended: 'Monitor; could be shelf-audit activity or reconnaissance.',
  },
  UNEXPECTED_LOCATION: {
    severity: 'MEDIUM', confidence: 79, detection: 'Route Conformance Model',
    description: (d) => `Package appeared in ${d.city ?? 'an unexpected location'}, outside the declared distribution route.`,
    recommended: 'Verify with the distributor whether a diversion was authorised.',
  },
  CERTIFICATION_TAMPERING: {
    severity: 'HIGH', confidence: 93, detection: 'Certificate Verifier',
    description: (d) => `Certification mark/ID ${d.certId ?? ''} failed verification against the certifying body registry.`,
    recommended: 'Suspend organic/premium claims; request certificate re-validation.',
  },
}

export interface IncidentSeed {
  type: ThreatType
  batchId: string
  ts: number
  location: string
  qrId?: string
  details?: Details
  evidence?: EvidenceItem[]
  status?: IncidentStatus
  severity?: Severity
  confidence?: number
}

export function makeIncident(id: string, s: IncidentSeed): Incident {
  const tpl = T[s.type]
  const d = { qrId: s.qrId, location: s.location, ...(s.details ?? {}) }
  const status = s.status ?? 'INVESTIGATING'
  const timeline = [
    { t: s.ts, text: `Detected by ${tpl.detection}` },
    { t: s.ts + 2 * MIN, text: 'Incident created and assigned to Security Analyst queue' },
  ]
  if (status === 'RESOLVED') timeline.push({ t: s.ts + 6 * HOUR, text: 'Resolved after investigation — evidence archived' })
  if (status === 'CONTAINED') timeline.push({ t: s.ts + 40 * MIN, text: 'Batch placed on hold; containment in progress' })
  return {
    incidentId: id,
    type: s.type,
    severity: s.severity ?? tpl.severity,
    batchId: s.batchId,
    timestamp: s.ts,
    location: s.location,
    description: tpl.description(d),
    evidence: s.evidence ?? [
      { label: 'Detected at', value: fmtDateTime(s.ts) },
      { label: 'Location', value: s.location },
      ...Object.entries(s.details ?? {}).map(([k, v]) => ({ label: k, value: String(v) })),
    ],
    status,
    detection: tpl.detection,
    confidence: s.confidence ?? tpl.confidence,
    qrId: s.qrId,
    recommended: tpl.recommended,
    timeline,
  }
}

export const isOpen = (i: Incident) => i.status !== 'RESOLVED' && i.status !== 'CONTAINED'
