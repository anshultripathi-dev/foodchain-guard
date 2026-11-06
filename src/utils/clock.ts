/** The prototype runs on a fixed simulated clock so the demo story is stable. */
export const NOW = new Date('2026-10-18T11:30:00+05:30').getTime()
export const DAY = 86_400_000
export const HOUR = 3_600_000
export const MIN = 60_000

export const iso = (ms: number) => new Date(ms).toISOString()
