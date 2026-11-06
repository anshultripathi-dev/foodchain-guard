export type NodeKey = 'farm' | 'processing' | 'distribution' | 'warehouse' | 'retail' | 'consumer'
export const NODE_KEYS: NodeKey[] = ['farm', 'processing', 'distribution', 'warehouse', 'retail', 'consumer']
export type NodeStatus = 'ok' | 'warn' | 'bad' | 'idle'
