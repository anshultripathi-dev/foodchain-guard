export type Role =
  | 'admin' | 'farmer' | 'processor' | 'distributor'
  | 'warehouse' | 'retailer' | 'consumer' | 'analyst'

export type ActorType = 'FARM' | 'PROCESSOR' | 'DISTRIBUTOR' | 'WAREHOUSE' | 'RETAILER' | 'CONSUMER'

export type Stage = 'HARVESTED' | 'PROCESSED' | 'DISTRIBUTED' | 'STORED' | 'RETAILED' | 'VERIFIED'

export const STAGES: Stage[] = ['HARVESTED', 'PROCESSED', 'DISTRIBUTED', 'STORED', 'RETAILED', 'VERIFIED']

export const STAGE_ACTOR: Record<Stage, ActorType> = {
  HARVESTED: 'FARM',
  PROCESSED: 'PROCESSOR',
  DISTRIBUTED: 'DISTRIBUTOR',
  STORED: 'WAREHOUSE',
  RETAILED: 'RETAILER',
  VERIFIED: 'CONSUMER',
}

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export const SEV_RANK: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }

export interface Actor {
  id: string
  name: string
  type: ActorType
  city: string
  lat: number
  lng: number
  region: string
  licence: string
  publicKey: string
}

export interface PackageMods {
  logo: boolean
  expiry: boolean
  cert: boolean
  qr: boolean
  color: boolean
  structure: boolean
  watermark: boolean
}
export const NO_MODS: PackageMods = {
  logo: false, expiry: false, cert: false, qr: false, color: false, structure: false, watermark: false,
}

export interface Pkg {
  packageId: string
  batchId: string
  qrId: string
  fingerprint: string
  watermarkId: string
  mods: PackageMods
  qrRevoked: boolean
}

export interface Batch {
  batchId: string
  product: string
  variety: string
  emoji: string
  unit: 'kg' | 'units'
  quantity: number
  packageCount: number
  farmId: string
  farm: string
  origin: string
  harvestDate: number
  processingDate: number
  expiryDate: number
  certification: string
  certId: string
  certValid: boolean
  qrId: string
  packagingFingerprint: string
  watermarkId: string
  /** actor ids along the intended route */
  route: { processorId: string; distributorId: string; warehouseId: string; retailerId: string }
  storage: { minC: number; maxC: number; humidityMin: number; humidityMax: number }
  /** manual override by security / recall operations */
  hold: 'NONE' | 'BLOCKED' | 'RECALLED'
  brand: string
  createdAt: number
}

export interface ChainEvent {
  eventId: string
  batchId: string
  index: number
  actorId: string
  actor: string
  actorType: ActorType
  location: string
  timestamp: number
  action: Stage
  quantity: number
  unit: 'kg' | 'units'
  temperatureC: number
  payloadDigest: string
  previousHash: string
  currentHash: string
  signature: string
}

export interface QrScan {
  scanId: string
  qrId: string
  batchId: string
  city: string
  timestamp: number
  source: 'consumer' | 'retailer' | 'analyst' | 'unknown'
}

export interface TelemetryPoint { t: number; tempC: number; humidity: number }

export type ThreatType =
  | 'COUNTERFEIT_PACKAGING' | 'QR_REPLAY' | 'LEDGER_TAMPERING' | 'QUANTITY_ANOMALY'
  | 'COLD_CHAIN_VIOLATION' | 'IMPOSSIBLE_TRAVEL' | 'EXPIRED_PRODUCT' | 'UNAUTHORIZED_EVENT'
  | 'REPEATED_SCAN' | 'UNEXPECTED_LOCATION' | 'CERTIFICATION_TAMPERING'

export const THREAT_LABEL: Record<ThreatType, string> = {
  COUNTERFEIT_PACKAGING: 'Counterfeit Packaging',
  QR_REPLAY: 'QR Replay Attack',
  LEDGER_TAMPERING: 'Ledger Tampering',
  QUANTITY_ANOMALY: 'Quantity Anomaly',
  COLD_CHAIN_VIOLATION: 'Cold Chain Violation',
  IMPOSSIBLE_TRAVEL: 'Impossible Travel',
  EXPIRED_PRODUCT: 'Expired Product',
  UNAUTHORIZED_EVENT: 'Unauthorized Event',
  REPEATED_SCAN: 'Repeated Scan',
  UNEXPECTED_LOCATION: 'Unexpected Location',
  CERTIFICATION_TAMPERING: 'Certification Tampering',
}

export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'ESCALATED' | 'CONTAINED' | 'RESOLVED'

export interface EvidenceItem { label: string; value: string }

export interface Incident {
  incidentId: string
  type: ThreatType
  severity: Severity
  batchId: string
  timestamp: number
  location: string
  description: string
  evidence: EvidenceItem[]
  status: IncidentStatus
  detection: string
  confidence: number
  qrId?: string
  recommended: string
  timeline: Array<{ t: number; text: string }>
}

export interface Anomaly {
  id: string
  type: ThreatType
  severity: Severity
  confidence: number
  batchId: string
  stage: Stage
  title: string
  evidence: string[]
  recommended: string
  qrId?: string
  eventId?: string
}

export interface Notification {
  id: string
  ts: number
  level: 'info' | 'success' | 'warning' | 'critical'
  title: string
  body: string
  batchId?: string
  read: boolean
}

export interface AuditEntry {
  id: string
  ts: number
  actor: string
  batchId: string
  action: string
  location: string
  hash: string
  status: 'VALID' | 'INVALID' | 'FLAGGED'
}

export interface RecallRecord {
  batchId: string
  initiatedAt: number
  reason: string
  notified: string[]
  status: 'IN_PROGRESS' | 'COMPLETE'
}

export interface Settings {
  minTempC: number
  maxTempC: number
  quantityTolerancePct: number
  maxPlausibleKmh: number
  replayCityThreshold: number
  autoBlockCritical: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  minTempC: 2,
  maxTempC: 8,
  quantityTolerancePct: 2,
  maxPlausibleKmh: 120,
  replayCityThreshold: 2,
  autoBlockCritical: false,
}

export type BatchStatus =
  | 'VERIFIED' | 'IN TRANSIT' | 'SUSPICIOUS' | 'COMPROMISED' | 'BLOCKED' | 'RECALLED'
  | 'EXPIRED' | 'NEAR EXPIRY' | 'COLD VIOLATION'
