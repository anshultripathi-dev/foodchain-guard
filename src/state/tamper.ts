import type { ChainEvent, Incident, Settings } from '../models/types'
import { makeIncident, nextIncidentId } from '../services/incidents'
import { NOW } from '../utils/clock'

/** Raise a ledger-tampering incident for a manual block edit (only one open per batch). */
export function raiseForTamper(
  incidents: Incident[], batchId: string, index: number, before: ChainEvent, after: ChainEvent, blocksAffected: number, _settings: Settings,
): Incident[] {
  if (incidents.some((i) => i.batchId === batchId && i.type === 'LEDGER_TAMPERING' && i.status !== 'RESOLVED')) return incidents
  const id = nextIncidentId(incidents, 'LEDGER_TAMPERING', batchId)
  const changed = before.quantity !== after.quantity ? `quantity ${before.quantity} → ${after.quantity}` : `timestamp ${before.timestamp} → ${after.timestamp}`
  return [
    makeIncident(id, {
      type: 'LEDGER_TAMPERING', batchId, ts: NOW, location: before.location, details: { block: index + 1 },
      evidence: [
        { label: 'Block', value: `#${index + 1} ${before.action}` }, { label: 'Field changed', value: changed },
        { label: 'Original hash', value: before.currentHash.slice(0, 24) + '…' }, { label: 'Recomputed hash', value: after.currentHash.slice(0, 24) + '…' },
        { label: 'Effect', value: `${blocksAffected - index} block(s) fail verification` },
      ],
    }),
    ...incidents,
  ]
}
