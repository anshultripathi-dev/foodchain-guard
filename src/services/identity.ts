import type { Batch } from '../models/types'
import { sha256 } from '../utils/sha256'
import { signSim, verifySim } from './crypto'
import { pristine } from '../data/seed'

export interface DigitalIdentity {
  batchId: string
  productId: string
  qrId: string
  fingerprint: string
  hash: string
  signature: string
  signerId: string
  createdAt: number
}

function core(b: Batch) {
  return {
    batchId: b.batchId, product: b.product, farmId: b.farmId, origin: b.origin, quantity: b.quantity, harvestDate: b.harvestDate,
    certId: b.certId, certValid: b.certValid, qrId: b.qrId, fp: b.packagingFingerprint, wm: b.watermarkId,
  }
}

export const identityHash = (b: Batch) => sha256(JSON.stringify(core(b)))

export function digitalIdentity(b: Batch, createdAt: number): DigitalIdentity {
  const hash = identityHash(b)
  return {
    batchId: b.batchId,
    productId: 'PRD-' + sha256('prd' + b.product + b.variety).slice(0, 8).toUpperCase(),
    qrId: b.qrId, fingerprint: b.packagingFingerprint, hash,
    signature: signSim(b.farmId, hash), signerId: b.farmId, createdAt,
  }
}

/** Identity of record: what the farm signed at registration. */
export function registeredIdentity(b: Batch, createdAt: number): DigitalIdentity {
  const p = pristine(b.batchId)
  return digitalIdentity(p ? p.batch : b, createdAt)
}

export function identityValid(b: Batch, createdAt: number) {
  const reg = registeredIdentity(b, createdAt)
  const now = digitalIdentity(b, createdAt)
  const hashOk = reg.hash === now.hash
  const sigOk = verifySim(reg.signerId, reg.hash, reg.signature)
  return { valid: hashOk && sigOk, hashOk, sigOk, registered: reg, current: now }
}
