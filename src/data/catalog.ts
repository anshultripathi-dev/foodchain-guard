import type { Actor, ActorType } from '../models/types'
import { CITIES } from '../utils/geo'
import { publicKeyFor } from '../services/crypto'

function actor(id: string, name: string, type: ActorType, city: string, region: string): Actor {
  const c = CITIES[city]
  return { id, name, type, city, lat: c.lat, lng: c.lng, region, licence: `FSSAI-${type.slice(0, 2)}-${id.replace(/\D/g, '').padStart(4, '0')}${city.length}`, publicKey: publicKeyFor(id) }
}

export const ACTORS: Actor[] = [
  // Farms (5)
  actor('farm-1', 'Green Valley Farm', 'FARM', 'Ratnagiri', 'Konkan'),
  actor('farm-2', 'Sahyadri Organics', 'FARM', 'Nashik', 'North Maharashtra'),
  actor('farm-3', 'Konkan Harvest Co-op', 'FARM', 'Devgad', 'Konkan'),
  actor('farm-4', 'Deccan Agro Fields', 'FARM', 'Baramati', 'Pune Region'),
  actor('farm-5', 'Mahabaleshwar Berry Estate', 'FARM', 'Mahabaleshwar', 'Western Ghats'),
  // Processing (3)
  actor('proc-1', 'FreshPack Processing Plant', 'PROCESSOR', 'Navi Mumbai', 'Mumbai MMR'),
  actor('proc-2', 'Konkan Agro Processors', 'PROCESSOR', 'Ratnagiri', 'Konkan'),
  actor('proc-3', 'Chakan FoodTech Plant', 'PROCESSOR', 'Chakan', 'Pune Region'),
  // Distributors (3)
  actor('dist-1', 'Mumbai Distribution Hub', 'DISTRIBUTOR', 'Bhiwandi', 'Mumbai MMR'),
  actor('dist-2', 'Western Logistics Pvt Ltd', 'DISTRIBUTOR', 'Nashik', 'North Maharashtra'),
  actor('dist-3', 'Coldline Distribution', 'DISTRIBUTOR', 'Thane', 'Mumbai MMR'),
  // Warehouses (5)
  actor('wh-1', 'Pune Cold Warehouse', 'WAREHOUSE', 'Pune', 'Pune Region'),
  actor('wh-2', 'Nashik Cold Store', 'WAREHOUSE', 'Nashik', 'North Maharashtra'),
  actor('wh-3', 'Vashi Port Warehouse', 'WAREHOUSE', 'Navi Mumbai', 'Mumbai MMR'),
  actor('wh-4', 'Thane Fulfilment Centre', 'WAREHOUSE', 'Thane', 'Mumbai MMR'),
  actor('wh-5', 'Bengaluru Cold Hub', 'WAREHOUSE', 'Bengaluru', 'South'),
  // Retailers (17)
  actor('ret-1', 'Mumbai Retail Network', 'RETAILER', 'Mumbai', 'Mumbai MMR'),
  actor('ret-2', 'FreshBasket Andheri', 'RETAILER', 'Mumbai', 'Mumbai MMR'),
  actor('ret-3', 'FreshBasket Bandra', 'RETAILER', 'Mumbai', 'Mumbai MMR'),
  actor('ret-4', 'GreenCart Kothrud', 'RETAILER', 'Pune', 'Pune Region'),
  actor('ret-5', 'GreenCart Baner', 'RETAILER', 'Pune', 'Pune Region'),
  actor('ret-6', 'Organic Bazaar Nashik', 'RETAILER', 'Nashik', 'North Maharashtra'),
  actor('ret-7', 'Metro Fresh Thane', 'RETAILER', 'Thane', 'Mumbai MMR'),
  actor('ret-8', 'DailyFresh Vashi', 'RETAILER', 'Navi Mumbai', 'Mumbai MMR'),
  actor('ret-9', 'Nature’s Basket Pune', 'RETAILER', 'Pune', 'Pune Region'),
  actor('ret-10', 'Harvest Hub Powai', 'RETAILER', 'Mumbai', 'Mumbai MMR'),
  actor('ret-11', 'FreshBasket Juhu', 'RETAILER', 'Mumbai', 'Mumbai MMR'),
  actor('ret-12', 'GreenCart Hinjewadi', 'RETAILER', 'Pune', 'Pune Region'),
  actor('ret-13', 'Organic Bazaar Gangapur', 'RETAILER', 'Nashik', 'North Maharashtra'),
  actor('ret-14', 'Metro Fresh Kalyan', 'RETAILER', 'Thane', 'Mumbai MMR'),
  actor('ret-15', 'DailyFresh Nerul', 'RETAILER', 'Navi Mumbai', 'Mumbai MMR'),
  actor('ret-16', 'Pure Pantry Koregaon', 'RETAILER', 'Pune', 'Pune Region'),
  actor('ret-17', 'Pure Pantry Panchavati', 'RETAILER', 'Nashik', 'North Maharashtra'),
  // Verification node (consumer / auditor scans are anchored through this actor)
  actor('cons-1', 'Consumer Verification Node', 'CONSUMER', 'Mumbai', 'Mumbai MMR'),
]

export const ACTOR_BY_ID: Record<string, Actor> = Object.fromEntries(ACTORS.map((a) => [a.id, a]))
export const actorsOf = (t: ActorType) => ACTORS.filter((a) => a.type === t)
export const KNOWN_ACTOR_IDS = new Set(ACTORS.map((a) => a.id))

export interface ProductSpec {
  product: string
  variety: string
  emoji: string
  unit: 'kg' | 'units'
  shelfDays: number
  certs: string[]
  farmIds: string[]
  qtyRange: [number, number]
  brand: string
}

export const PRODUCTS: ProductSpec[] = [
  { product: 'Organic Alphonso Mango', variety: 'Alphonso (Hapus)', emoji: '🥭', unit: 'kg', shelfDays: 14, certs: ['Organic'], farmIds: ['farm-1', 'farm-3'], qtyRange: [1800, 3200], brand: 'Green Valley' },
  { product: 'Strawberries (Mahabaleshwar)', variety: 'Sweet Charlie', emoji: '🍓', unit: 'kg', shelfDays: 8, certs: ['GlobalGAP', 'Organic'], farmIds: ['farm-5'], qtyRange: [400, 900], brand: 'Berry Estate' },
  { product: 'Fresh Paneer', variety: 'Full-cream', emoji: '🧀', unit: 'units', shelfDays: 12, certs: ['FSSAI Premium'], farmIds: ['farm-4'], qtyRange: [800, 1400], brand: 'Deccan Dairy' },
  { product: 'Cold-Pressed Coconut Water', variety: 'Tender coconut', emoji: '🥥', unit: 'units', shelfDays: 20, certs: ['FSSAI Premium', 'Organic'], farmIds: ['farm-3'], qtyRange: [1000, 1000], brand: 'Konkan Pure' },
  { product: 'Organic Tomatoes', variety: 'Roma', emoji: '🍅', unit: 'kg', shelfDays: 12, certs: ['Organic'], farmIds: ['farm-2', 'farm-4'], qtyRange: [900, 2000], brand: 'Sahyadri' },
  { product: 'Baby Spinach', variety: 'Hydroponic', emoji: '🥬', unit: 'kg', shelfDays: 9, certs: ['Organic', 'GlobalGAP'], farmIds: ['farm-2'], qtyRange: [300, 700], brand: 'Sahyadri' },
  { product: 'Nashik Red Grapes', variety: 'Thompson Seedless', emoji: '🍇', unit: 'kg', shelfDays: 16, certs: ['GlobalGAP'], farmIds: ['farm-2'], qtyRange: [1200, 2600], brand: 'Sahyadri' },
  { product: 'A2 Cow Milk', variety: 'Gir cow', emoji: '🥛', unit: 'units', shelfDays: 7, certs: ['FSSAI Premium'], farmIds: ['farm-4'], qtyRange: [1500, 3000], brand: 'Deccan Dairy' },
  { product: 'Pomegranate (Bhagwa)', variety: 'Bhagwa', emoji: '🍎', unit: 'kg', shelfDays: 21, certs: ['GlobalGAP'], farmIds: ['farm-4', 'farm-2'], qtyRange: [1000, 2400], brand: 'Deccan Agro' },
  { product: 'Organic Green Peas', variety: 'Garden peas', emoji: '🫛', unit: 'kg', shelfDays: 10, certs: ['Organic'], farmIds: ['farm-2', 'farm-4'], qtyRange: [500, 1200], brand: 'Sahyadri' },
]
