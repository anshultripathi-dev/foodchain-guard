import { getDemoData, getBaseData } from '../src/data/seed'
import { analyzeAll } from '../src/services/analysis'
import { DEFAULT_SETTINGS } from '../src/models/types'
import { isOpen } from '../src/services/incidents'

for (const [name, d] of [['base', getBaseData()], ['demo', getDemoData()]] as const) {
  const a = analyzeAll({ ...d, settings: DEFAULT_SETTINGS })
  console.log('==', name, 'batches', d.batches.length, 'pkgs', d.packages.length, 'events', d.events.length, 'incidents', d.incidents.length, 'open', d.incidents.filter(isOpen).length)
  console.log('chainIntegrity', a.chainIntegrity.toFixed(2), 'authenticRate', a.authenticRate.toFixed(2), 'anomalies', a.anomalies.length)
  const h = a.byId['FCG-2026-00421']
  console.log('hero', h.status, h.scores, h.trust.trust, h.trust.authenticity, h.cold.storageScore, h.packaging.overall.toFixed(1), h.classification.probs)
  console.log(a.anomalies.map((x) => `${x.batchId.slice(-5)} ${x.type} ${x.severity}`).join('\n'))
  console.log(a.list.map(x => `${x.batch.batchId.slice(-5)}:${x.status}:${x.stage}:${x.days}`).join(' '))
}
