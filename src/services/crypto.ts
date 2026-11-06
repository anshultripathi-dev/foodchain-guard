import { sha256, toHex, sha256Bytes } from '../utils/sha256'
import { makeRng } from '../utils/prng'
import type { Batch, ChainEvent } from '../models/types'

/**
 * SIMULATED cryptography.
 * - AES-256-GCM: SHA-256 in counter mode used as a keystream (NOT real AES) – deterministic so the demo is repeatable.
 * - ECDSA: signatures are SHA-256 derived tags bound to the signer's (simulated) private key.
 * The structure mirrors a real design so real primitives (WebCrypto) can be dropped in later.
 */

export function publicKeyFor(id: string): string {
  return '04' + sha256('pk-x:' + id) + sha256('pk-y:' + id)
}

function keyBytes(keyId: string): Uint8Array {
  return sha256Bytes(new TextEncoder().encode('aes-256-key:' + keyId))
}

export interface AesRecord {
  algorithm: string
  keyId: string
  iv: string
  ciphertext: string
  tag: string
}

export function aesEncryptSim(plaintext: string, keyId = 'kms/fcg-master-01'): AesRecord {
  const key = keyBytes(keyId)
  const pt = new TextEncoder().encode(plaintext)
  const ivBytes = sha256Bytes(new TextEncoder().encode('iv:' + keyId + plaintext)).slice(0, 12)
  const out = new Uint8Array(pt.length)
  let block = new Uint8Array(0)
  for (let i = 0; i < pt.length; i++) {
    if (i % 32 === 0) {
      const ctr = new Uint8Array(key.length + ivBytes.length + 4)
      ctr.set(key); ctr.set(ivBytes, key.length)
      new DataView(ctr.buffer).setUint32(key.length + ivBytes.length, i / 32)
      block = sha256Bytes(ctr)
    }
    out[i] = pt[i] ^ block[i % 32]
  }
  const ciphertext = toHex(out)
  return {
    algorithm: 'AES-256-GCM (simulated)',
    keyId,
    iv: toHex(ivBytes),
    ciphertext,
    tag: sha256('tag:' + toHex(key).slice(0, 16) + ciphertext).slice(0, 32),
  }
}

export function aesDecryptSim(rec: AesRecord): string | null {
  const key = keyBytes(rec.keyId)
  if (sha256('tag:' + toHex(key).slice(0, 16) + rec.ciphertext).slice(0, 32) !== rec.tag) return null
  const ct = new Uint8Array(rec.ciphertext.match(/../g)!.map((h) => parseInt(h, 16)))
  const ivBytes = new Uint8Array(rec.iv.match(/../g)!.map((h) => parseInt(h, 16)))
  const out = new Uint8Array(ct.length)
  let block = new Uint8Array(0)
  for (let i = 0; i < ct.length; i++) {
    if (i % 32 === 0) {
      const ctr = new Uint8Array(key.length + ivBytes.length + 4)
      ctr.set(key); ctr.set(ivBytes, key.length)
      new DataView(ctr.buffer).setUint32(key.length + ivBytes.length, i / 32)
      block = sha256Bytes(ctr)
    }
    out[i] = ct[i] ^ block[i % 32]
  }
  return new TextDecoder().decode(out)
}

export function signSim(signerId: string, hash: string): string {
  return sha256(`ecdsa-r:${signerId}|${hash}`) + sha256(`ecdsa-s:${signerId}|${hash}`)
}
export function verifySim(signerId: string, hash: string, sig: string): boolean {
  return signSim(signerId, hash) === sig
}

/** Sensitive off-chain business metadata. Never leaves secure storage, never shown to consumers. */
export interface SensitiveMeta {
  custodian: string
  contact: string
  gps: string
  pricePerUnitInr: number
  labReportNo: string
  vehicle: string
  note: string
}

export function sensitiveMetaFor(batch: Batch, ev: Pick<ChainEvent, 'actor' | 'action' | 'eventId' | 'quantity' | 'location'>): SensitiveMeta {
  const r = makeRng(ev.eventId + batch.batchId)
  return {
    custodian: ev.actor,
    contact: `+91 98${r.int(10, 99)}${r.int(1000, 9999)}${r.int(10, 99)}`,
    gps: `${(15 + r.next() * 5).toFixed(5)}, ${(72.5 + r.next() * 2).toFixed(5)}`,
    pricePerUnitInr: Math.round(r.range(28, 260)),
    labReportNo: `LAB/${2026}/${r.int(10000, 99999)}`,
    vehicle: `MH-${r.int(1, 49).toString().padStart(2, '0')}-${String.fromCharCode(65 + r.int(0, 25))}${String.fromCharCode(65 + r.int(0, 25))}-${r.int(1000, 9999)}`,
    note: `${ev.action} of ${ev.quantity} ${batch.unit} at ${ev.location}`,
  }
}

export function encryptRecord(meta: SensitiveMeta, keyId?: string) {
  const plaintext = JSON.stringify(meta)
  const enc = aesEncryptSim(plaintext, keyId)
  const digest = sha256(enc.iv + enc.ciphertext + enc.tag)
  return { plaintext, enc, digest }
}
