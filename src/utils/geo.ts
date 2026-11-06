export interface City { name: string; lat: number; lng: number }

export const CITIES: Record<string, City> = {
  Ratnagiri: { name: 'Ratnagiri', lat: 16.99, lng: 73.3 },
  Devgad: { name: 'Devgad', lat: 16.38, lng: 73.38 },
  Mumbai: { name: 'Mumbai', lat: 19.076, lng: 72.878 },
  'Navi Mumbai': { name: 'Navi Mumbai', lat: 19.033, lng: 73.03 },
  Thane: { name: 'Thane', lat: 19.218, lng: 72.978 },
  Bhiwandi: { name: 'Bhiwandi', lat: 19.3, lng: 73.06 },
  Pune: { name: 'Pune', lat: 18.52, lng: 73.857 },
  Chakan: { name: 'Chakan', lat: 18.76, lng: 73.86 },
  Nashik: { name: 'Nashik', lat: 19.998, lng: 73.789 },
  Mahabaleshwar: { name: 'Mahabaleshwar', lat: 17.92, lng: 73.66 },
  Baramati: { name: 'Baramati', lat: 18.15, lng: 74.58 },
  Delhi: { name: 'Delhi', lat: 28.61, lng: 77.21 },
  Bengaluru: { name: 'Bengaluru', lat: 12.97, lng: 77.59 },
  Hyderabad: { name: 'Hyderabad', lat: 17.385, lng: 78.487 },
  Ahmedabad: { name: 'Ahmedabad', lat: 23.02, lng: 72.57 },
  Chennai: { name: 'Chennai', lat: 13.08, lng: 80.27 },
  Kolkata: { name: 'Kolkata', lat: 22.57, lng: 88.36 },
  Nagpur: { name: 'Nagpur', lat: 21.145, lng: 79.088 },
}

export function haversineKm(a: City, b: City): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Approximate road distance (great-circle x 1.22) rounded to nearest 10 km. */
export function roadKm(a: string, b: string): number {
  const ca = CITIES[a], cb = CITIES[b]
  if (!ca || !cb) return 0
  return Math.round((haversineKm(ca, cb) * 1.22) / 10) * 10
}

export const AVG_ROAD_SPEED_KMH = 80

// Rough India outline (lng,lat) – stylised, for the map visual only.
export const INDIA_OUTLINE: Array<[number, number]> = [
  [68.2, 23.6], [70.2, 20.9], [72.8, 21.1], [72.6, 19.0], [73.3, 16.0], [74.5, 13.2], [75.6, 11.8],
  [76.6, 8.4], [77.5, 8.1], [78.2, 8.9], [79.8, 10.3], [80.2, 12.8], [80.1, 15.8], [82.3, 16.9],
  [84.8, 19.2], [86.9, 21.2], [88.1, 21.6], [89.0, 22.3], [88.7, 24.2], [91.6, 25.2], [92.6, 24.3],
  [93.4, 22.8], [94.6, 25.8], [97.3, 27.9], [95.2, 29.3], [92.0, 27.8], [88.9, 27.3], [86.0, 27.9],
  [81.9, 30.0], [79.0, 31.3], [78.8, 34.2], [77.0, 35.5], [74.4, 36.8], [73.9, 34.4], [74.7, 32.8],
  [74.5, 31.4], [74.1, 30.0], [71.0, 27.8], [69.8, 26.7], [70.3, 24.9], [68.2, 23.6],
]

export function makeProjector(w: number, h: number, pad = 18) {
  const minLng = 67.5, maxLng = 98, minLat = 7.5, maxLat = 37
  const sx = (w - pad * 2) / (maxLng - minLng)
  const sy = (h - pad * 2) / (maxLat - minLat)
  const s = Math.min(sx, sy)
  const ox = (w - s * (maxLng - minLng)) / 2
  const oy = (h - s * (maxLat - minLat)) / 2
  return (lat: number, lng: number): [number, number] => [ox + (lng - minLng) * s, oy + (maxLat - lat) * s]
}
