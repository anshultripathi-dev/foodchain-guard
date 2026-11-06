import { shallow } from 'zustand/shallow'
import { useStore } from './store'
import type { EngineInput, GlobalAnalysis, BatchAnalysis } from '../services/analysis'
import { analysisFor } from '../services/analysisCache'
import type { Incident } from '../models/types'
import { isOpen } from '../services/incidents'


/** Single shared, memoised analysis of the whole network (chains, anomalies, trust scores). */
export function useAnalysis(): GlobalAnalysis {
  const inp = useStore(
    (s) => ({ batches: s.batches, packages: s.packages, events: s.events, scans: s.scans, telemetry: s.telemetry, settings: s.settings }),
    shallow,
  )
  return analysisFor(inp)
}

export function getAnalysisNow(): GlobalAnalysis {
  const s = useStore.getState()
  return analysisFor({ batches: s.batches, packages: s.packages, events: s.events, scans: s.scans, telemetry: s.telemetry, settings: s.settings })
}

export function useSelectedAnalysis(): BatchAnalysis {
  const a = useAnalysis()
  const id = useStore((s) => s.selectedBatchId)
  return a.byId[id] ?? a.list[0]
}

export function useBatchAnalysis(id?: string): BatchAnalysis | undefined {
  const a = useAnalysis()
  return id ? a.byId[id] : undefined
}

export interface SocStats {
  counts: Record<string, number>
  open: Incident[]
  openCount: number
  bySeverity: Record<string, number>
}

export function useSocStats(): SocStats {
  const incidents = useStore((s) => s.incidents)
  const counts: Record<string, number> = {}
  const bySeverity: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
  incidents.forEach((i) => {
    counts[i.type] = (counts[i.type] ?? 0) + 1
    if (isOpen(i)) bySeverity[i.severity]++
  })
  const open = incidents.filter(isOpen)
  return { counts, open, openCount: open.length, bySeverity }
}

export function getEngineInput(): EngineInput {
  const s = useStore.getState()
  return { batches: s.batches, packages: s.packages, events: s.events, scans: s.scans, telemetry: s.telemetry, settings: s.settings }
}
