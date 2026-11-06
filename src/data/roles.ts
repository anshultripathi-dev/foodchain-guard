import type { Batch, Role } from '../models/types'

export type NavId =
  | 'overview' | 'supply-chain' | 'batches' | 'identity' | 'blockchain' | 'packaging' | 'verification' | 'anomalies'
  | 'cold-chain' | 'expiry' | 'recall' | 'soc' | 'audit' | 'reports' | 'assistant'

export interface RoleDef {
  id: Role
  label: string
  short: string
  blurb: string
  nav: NavId[] | 'all'
  home: string
  actorId?: string
  actorName?: string
  accent: string
  scope?: (b: Batch) => boolean
  tasks: Array<{ label: string; to: string }>
}

export const ROLES: RoleDef[] = [
  {
    id: 'admin', label: 'Platform Administrator', short: 'Admin', blurb: 'Full network view: governance, keys, settings and incident oversight.',
    nav: 'all', home: '/app/overview', accent: '#22d3ee',
    tasks: [{ label: 'Open Security Operations', to: '/app/soc' }, { label: 'Run the Demo Lab', to: '/app/demo' }, { label: 'Review the audit log', to: '/app/audit' }],
  },
  {
    id: 'farmer', label: 'Farmer', short: 'Farmer', blurb: 'Register harvest batches and issue their digital identity.',
    nav: ['overview', 'supply-chain', 'batches', 'identity', 'expiry', 'reports', 'assistant'], home: '/app/batches', actorId: 'farm-1', actorName: 'Green Valley Farm', accent: '#4ade80',
    scope: (b) => b.farmId === 'farm-1',
    tasks: [{ label: 'Register a new batch', to: '/app/batches/new' }, { label: 'View digital identities', to: '/app/identity' }],
  },
  {
    id: 'processor', label: 'Processing Plant', short: 'Processor', blurb: 'Log processing events, seal packaging fingerprints and watermarks.',
    nav: ['overview', 'supply-chain', 'batches', 'identity', 'blockchain', 'packaging', 'verification', 'assistant'], home: '/app/packaging', actorId: 'proc-1', actorName: 'FreshPack Processing Plant', accent: '#f59e0b',
    scope: (b) => b.route.processorId === 'proc-1',
    tasks: [{ label: 'Verify packaging', to: '/app/packaging' }, { label: 'Inspect hash chain', to: '/app/blockchain' }],
  },
  {
    id: 'distributor', label: 'Distributor', short: 'Distributor', blurb: 'Track shipments, hand-offs and route conformance.',
    nav: ['overview', 'supply-chain', 'batches', 'blockchain', 'cold-chain', 'anomalies', 'recall', 'audit', 'assistant'], home: '/app/supply-chain', actorId: 'dist-1', actorName: 'Mumbai Distribution Hub', accent: '#60a5fa',
    scope: (b) => b.route.distributorId === 'dist-1',
    tasks: [{ label: 'Follow shipments in 3D', to: '/app/supply-chain' }, { label: 'Check route anomalies', to: '/app/anomalies' }],
  },
  {
    id: 'warehouse', label: 'Warehouse Manager', short: 'Warehouse', blurb: 'Monitor cold storage, inventory and expiry.',
    nav: ['overview', 'supply-chain', 'batches', 'cold-chain', 'expiry', 'anomalies', 'audit', 'assistant'], home: '/app/cold-chain', actorId: 'wh-1', actorName: 'Pune Cold Warehouse', accent: '#38bdf8',
    scope: (b) => b.route.warehouseId === 'wh-1',
    tasks: [{ label: 'Cold-chain monitor', to: '/app/cold-chain' }, { label: 'Expiry intelligence', to: '/app/expiry' }],
  },
  {
    id: 'retailer', label: 'Retailer', short: 'Retailer', blurb: 'Verify incoming stock and handle recalls at shelf level.',
    nav: ['overview', 'batches', 'verification', 'packaging', 'expiry', 'recall', 'assistant'], home: '/app/verification', actorId: 'ret-1', actorName: 'Mumbai Retail Network', accent: '#34d399',
    scope: (b) => b.route.retailerId === 'ret-1',
    tasks: [{ label: 'Scan & verify a QR', to: '/app/verification' }, { label: 'Check recalls', to: '/app/recall' }],
  },
  {
    id: 'consumer', label: 'Consumer', short: 'Consumer', blurb: 'Scan a product and see its story in plain language.',
    nav: [], home: '/consumer', accent: '#fbbf24', tasks: [],
  },
  {
    id: 'analyst', label: 'Security Analyst', short: 'Analyst', blurb: 'Hunt anomalies, triage incidents, run the attack lab.',
    nav: 'all', home: '/app/soc', accent: '#a78bfa',
    tasks: [{ label: 'Triage open incidents', to: '/app/soc' }, { label: 'Anomaly center', to: '/app/anomalies' }, { label: 'Attack simulation lab', to: '/app/demo' }],
  },
]

export const ROLE_BY_ID: Record<Role, RoleDef> = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<Role, RoleDef>
