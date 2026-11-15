// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Starts the embedding worker on the first focus of the question box and asks it for question vectors.
// If the model is not ready, the question is answered with keyword search and no message is shown.
import { useCallback, useEffect, useRef, useState } from 'react'

export type MeaningStatus = 'idle' | 'loading' | 'ready' | 'failed'
const LOAD_LIMIT_MS = 15000
const EMBED_LIMIT_MS = 1500

export function useMeaning(enabled: boolean): { status: MeaningStatus; start: () => void; embed: (text: string) => Promise<Float32Array | null> } {
  const [status, setStatus] = useState<MeaningStatus>('idle')
  const worker = useRef<Worker | null>(null)
  const waiting = useRef(new Map<number, (value: Float32Array | null) => void>())
  const next = useRef(1)
  const state = useRef<MeaningStatus>('idle')
  const set = (value: MeaningStatus) => {
    state.current = value
    setStatus(value)
  }
  const start = useCallback(() => {
    if (!enabled || worker.current || state.current !== 'idle' || typeof Worker === 'undefined') return
    try {
      const w = new Worker(new URL('../workers/embed.worker.ts', import.meta.url), { type: 'module' })
      worker.current = w
      set('loading')
      const timer = setTimeout(() => {
        if (state.current === 'loading') set('failed')
      }, LOAD_LIMIT_MS)
      w.onmessage = (event: MessageEvent<{ id: number; ready?: boolean; vector?: Float32Array; error?: string }>) => {
        const { id, ready, vector, error } = event.data
        if (ready) {
          clearTimeout(timer)
          set('ready')
          return
        }
        if (error && id === 0) {
          clearTimeout(timer)
          set('failed')
          return
        }
        const resolve = waiting.current.get(id)
        waiting.current.delete(id)
        resolve?.(vector ?? null)
      }
      w.onerror = () => {
        clearTimeout(timer)
        set('failed')
      }
      w.postMessage({ id: 0 })
    } catch {
      set('failed')
    }
  }, [enabled])
  useEffect(
    () => () => {
      worker.current?.terminate()
      worker.current = null
    },
    [],
  )
  const embed = useCallback((text: string): Promise<Float32Array | null> => {
    const w = worker.current
    if (!w || state.current !== 'ready') return Promise.resolve(null)
    return new Promise((resolve) => {
      const id = next.current++
      const timer = setTimeout(() => {
        waiting.current.delete(id)
        resolve(null)
      }, EMBED_LIMIT_MS)
      waiting.current.set(id, (value) => {
        clearTimeout(timer)
        resolve(value)
      })
      w.postMessage({ id, text })
    })
  }, [])
  return { status, start, embed }
}
