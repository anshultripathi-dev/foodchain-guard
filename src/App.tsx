import { Fragment, type ReactNode } from 'react'
import { useHashPath, matchRoute } from './utils/router'
import { AppLayout } from './layouts/AppLayout'
import { Overview } from './features/dashboard/Overview'
import { CommandCenter } from './features/supply-chain/CommandCenter'
import { Registry } from './features/batches/Registry'
import { CreateBatch } from './features/batches/CreateBatch'
import { BatchDetails } from './features/batches/BatchDetails'
import { DigitalIdentity } from './features/cryptography/DigitalIdentity'
import { Explorer } from './features/blockchain/Explorer'
import { PackagingHub } from './features/packaging/PackagingHub'
import { VerificationHub } from './features/verification/VerificationHub'
import { AnomalyHub } from './features/anomalies/AnomalyHub'
import { ColdChain } from './features/cold-chain/ColdChain'
import { RecallCenter } from './features/recall/RecallCenter'
import { SOC } from './features/security/SOC'
import { IncidentDetail } from './features/security/IncidentDetail'
import { AuditLog } from './features/security/AuditLog'
import { Assistant } from './features/assistant/Assistant'
import { Reports } from './features/dashboard/Reports'
import { NotificationsPage } from './features/dashboard/NotificationsPage'
import { SettingsPage } from './features/dashboard/SettingsPage'
import { DemoLab } from './features/demo/DemoLab'
import { ConsumerApp } from './features/consumer/ConsumerApp'
import { Landing } from './pages/Landing'
import { RoleSelect } from './pages/RoleSelect'
import { Toasts } from './components/ui'
import { ExpiryAndSafety } from './features/dashboard/ExpiryAndSafety'

interface R { path: string; el: (p: Record<string, string>) => ReactNode }

const APP_ROUTES: R[] = [
  { path: '/app/overview', el: () => <Overview /> },
  { path: '/app/supply-chain', el: () => <CommandCenter /> },
  { path: '/app/identity', el: () => <DigitalIdentity /> },
  { path: '/app/crypto', el: () => <DigitalIdentity initialTab="crypto" /> },
  { path: '/app/blockchain', el: () => <Explorer /> },
  { path: '/app/packaging', el: () => <PackagingHub /> },
  { path: '/app/packaging/viewer', el: () => <PackagingHub initialTab="viewer" /> },
  { path: '/app/packaging/ai', el: () => <PackagingHub initialTab="ai" /> },
  { path: '/app/packaging/heatmap', el: () => <PackagingHub initialTab="heatmap" /> },
  { path: '/app/verification', el: () => <VerificationHub /> },
  { path: '/app/verification/engine', el: () => <VerificationHub initialTab="engine" /> },
  { path: '/app/anomalies', el: () => <AnomalyHub /> },
  { path: '/app/anomalies/replay', el: () => <AnomalyHub initialTab="replay" /> },
  { path: '/app/anomalies/travel', el: () => <AnomalyHub initialTab="travel" /> },
  { path: '/app/anomalies/quantity', el: () => <AnomalyHub initialTab="quantity" /> },
  { path: '/app/cold-chain', el: () => <ColdChain /> },
  { path: '/app/expiry', el: () => <ExpiryAndSafety /> },
  { path: '/app/food-safety', el: () => <ExpiryAndSafety initialTab="safety" /> },
  { path: '/app/recall', el: () => <RecallCenter /> },
  { path: '/app/soc', el: () => <SOC /> },
  { path: '/app/soc/:id', el: (p) => <IncidentDetail id={p.id} /> },
  { path: '/app/audit', el: () => <AuditLog /> },
  { path: '/app/assistant', el: () => <Assistant /> },
  { path: '/app/reports', el: () => <Reports /> },
  { path: '/app/notifications', el: () => <NotificationsPage /> },
  { path: '/app/settings', el: () => <SettingsPage /> },
  { path: '/app/demo', el: () => <DemoLab /> },
  { path: '/app/batches', el: () => <Registry /> },
  { path: '/app/batches/new', el: () => <CreateBatch /> },
  { path: '/app/batches/:id', el: (p) => <BatchDetails id={p.id} /> },
]

export function App() {
  const path = useHashPath()
  if (path === '/' || path === '') return <><Landing /><Toasts /></>
  if (path === '/login') return <><RoleSelect /><Toasts /></>
  if (path.startsWith('/consumer')) return <><ConsumerApp /><Toasts /></>
  for (const r of APP_ROUTES) {
    const p = matchRoute(r.path, path)
    if (p) return <AppLayout path={path}><Fragment key={path}>{r.el(p)}</Fragment></AppLayout>
  }
  return <AppLayout path={path}><div className="p-10 text-slate-400">Not found: {path}</div></AppLayout>
}
