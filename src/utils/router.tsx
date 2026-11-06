import { useEffect, useState, type ReactNode, type MouseEvent } from 'react'

const getPath = () => (window.location.hash.replace(/^#/, '') || '/').split('?')[0] || '/'

export function useHashPath(): string {
  const [path, setPath] = useState(getPath())
  useEffect(() => {
    const on = () => setPath(getPath())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return path
}

export function navigate(to: string) {
  window.location.hash = to
}

export function useQuery(): URLSearchParams {
  const path = useHashPath() // re-render on navigation
  void path
  const q = window.location.hash.split('?')[1] ?? ''
  return new URLSearchParams(q)
}

export function Link({ to, children, className, onClick, title }: { to: string; children: ReactNode; className?: string; onClick?: (e: MouseEvent) => void; title?: string }) {
  return (
    <a href={`#${to}`} className={className} onClick={onClick} title={title}>
      {children}
    </a>
  )
}

export interface RouteDef<P = Record<string, string>> { path: string; render: (params: P) => ReactNode }

export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean)
  const b = path.split('/').filter(Boolean)
  if (a.length !== b.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return params
}
