import { create } from 'zustand'

export interface Toast {
  id: number
  title: string
  message?: string
  tone: 'good' | 'bad' | 'info'
}

interface ToastState {
  items: Toast[]
  push: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

// Bad news needs longer on screen than a confirmation.
const LIFETIME: Record<Toast['tone'], number> = { good: 4200, info: 4200, bad: 7000 }

let seq = 0

export const useToasts = create<ToastState>(set => ({
  items: [],
  push: t => {
    const id = ++seq
    set(s => ({ items: [...s.items, { ...t, id }] }))
    setTimeout(() => set(s => ({ items: s.items.filter(i => i.id !== id) })), LIFETIME[t.tone])
  },
  dismiss: id => set(s => ({ items: s.items.filter(i => i.id !== id) })),
}))
