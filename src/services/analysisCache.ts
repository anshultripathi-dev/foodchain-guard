import { analyzeAll, type EngineInput, type GlobalAnalysis } from './analysis'

let cacheKey: unknown[] = []
let cacheVal: GlobalAnalysis | null = null

/** Memoised on the identity of the underlying state slices, so every screen shares one analysis pass. */
export function analysisFor(inp: EngineInput): GlobalAnalysis {
  const key = [inp.batches, inp.packages, inp.events, inp.scans, inp.telemetry, inp.settings]
  if (cacheVal && key.every((k, i) => k === cacheKey[i])) return cacheVal
  cacheKey = key
  cacheVal = analyzeAll(inp)
  return cacheVal
}
