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

let seq = 0

export const useToasts = create<ToastState>(set => ({
  items: [],
  push: t => {
    const id = ++seq
    set(s => ({ items: [...s.items, { ...t, id }] }))
    setTimeout(() => set(s => ({ items: s.items.filter(i => i.id !== id) })), 4200)
  },
  dismiss: id => set(s => ({ items: s.items.filter(i => i.id !== id) })),
}))
