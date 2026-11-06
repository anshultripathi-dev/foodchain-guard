import { sha256 } from '../utils/sha256'
import { signSim, verifySim } from './crypto'
import type { ChainEvent } from '../models/types'

export const GENESIS_HASH = '0'.repeat(64)

type HashInput = Pick<
  ChainEvent,
  'index' | 'timestamp' | 'batchId' | 'actorId' | 'action' | 'quantity' | 'location' | 'payloadDigest' | 'previousHash'
>

/** Hash(current block data + previous hash). */
export function computeHash(e: HashInput): string {
  return sha256(
    JSON.stringify({
      i: e.index, t: e.timestamp, b: e.batchId, a: e.actorId, x: e.action,
      q: e.quantity, l: e.location, p: e.payloadDigest, prev: e.previousHash,
    }),
  )
}

export function sealEvent(e: Omit<ChainEvent, 'currentHash' | 'signature'>): ChainEvent {
  const currentHash = computeHash(e)
  return { ...e, currentHash, signature: signSim(e.actorId, currentHash) }
}

export type BlockStatus =
  | 'VALID' | 'HASH_MISMATCH' | 'SIGNATURE_INVALID' | 'LINK_BROKEN'
  | 'UNAUTHORIZED_SIGNER' | 'DOWNSTREAM_INVALID'

export interface BlockCheck {
  eventId: string
  index: number
  status: BlockStatus
  hashOk: boolean
  linkOk: boolean
  sigOk: boolean
  message: string
}

export interface ChainValidation {
  valid: boolean
  brokenAt: number | null
  checks: BlockCheck[]
  invalidCount: number
}

export function validateChain(events: ChainEvent[], knownActors: Set<string>): ChainValidation {
  const checks: BlockCheck[] = []
  let brokenAt: number | null = null
  events.forEach((e, i) => {
    const hashOk = computeHash(e) === e.currentHash
    const linkOk = i === 0 ? e.previousHash === GENESIS_HASH : e.previousHash === events[i - 1].currentHash
    const known = knownActors.has(e.actorId)
    const sigOk = known && verifySim(e.actorId, e.currentHash, e.signature)
    let status: BlockStatus = 'VALID'
    let message = 'Hash recomputed, link and signature verified'
    if (!hashOk) { status = 'HASH_MISMATCH'; message = 'Stored hash does not match block contents' }
    else if (!known) { status = 'UNAUTHORIZED_SIGNER'; message = 'Signer is not a registered network actor' }
    else if (!sigOk) { status = 'SIGNATURE_INVALID'; message = 'Signature does not verify against the recorded hash' }
    else if (!linkOk) { status = 'LINK_BROKEN'; message = 'previousHash no longer matches the preceding block' }
    else if (brokenAt !== null) { status = 'DOWNSTREAM_INVALID'; message = 'Depends on an invalid upstream block' }
    if (status !== 'VALID' && brokenAt === null) brokenAt = i
    checks.push({ eventId: e.eventId, index: i, status, hashOk, linkOk, sigOk, message })
  })
  const invalidCount = checks.filter((c) => c.status !== 'VALID').length
  return { valid: brokenAt === null, brokenAt, checks, invalidCount }
}

/** Re-issue (legitimately re-sign) the chain from `from` onwards – used when an authorised actor records a new figure. */
export function rebuildChain(events: ChainEvent[], from = 0): ChainEvent[] {
  const out = events.slice()
  for (let i = from; i < out.length; i++) {
    const prev = i === 0 ? GENESIS_HASH : out[i - 1].currentHash
    out[i] = sealEvent({ ...out[i], previousHash: prev })
  }
  return out
}

/**
 * Attacker edits block contents. With `recompute` the attacker also rewrites the block's own hash
 * (but cannot forge the signer's signature or fix downstream links).
 */
export function tamperEvent(
  events: ChainEvent[],
  index: number,
  changes: Partial<Pick<ChainEvent, 'quantity' | 'timestamp'>>,
  recompute = true,
): ChainEvent[] {
  const out = events.slice()
  const mod = { ...out[index], ...changes }
  if (recompute) mod.currentHash = computeHash(mod)
  out[index] = mod
  return out
}
