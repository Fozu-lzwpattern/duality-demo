import { useState, useEffect, useRef, useCallback } from 'react'

export interface SceneEvent {
  type: 'step' | 'state_change' | 'gate_eval' | 'contract' | 'audit' | 'error' | 'complete'
  step: number
  title: string
  description: string
  data?: Record<string, unknown>
  timestamp: number
}

type SSEStatus = 'idle' | 'connecting' | 'connected' | 'error'

export function useSSE(sceneId: string, clientId: string) {
  const [events, setEvents] = useState<SceneEvent[]>([])
  const [status, setStatus] = useState<SSEStatus>('idle')
  const esRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
    }
    setStatus('connecting')
    const url = `/api/sse/scene/${sceneId}?clientId=${clientId}`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => setStatus('connected')
    es.onerror = () => setStatus('error')
    es.onmessage = (e) => {
      try {
        const event: SceneEvent = JSON.parse(e.data)
        if (event.step === 0) return // skip welcome
        setEvents(prev => [...prev, event])
      } catch {
        // ignore parse errors
      }
    }
  }, [sceneId, clientId])

  const disconnect = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    setStatus('idle')
  }, [])

  const reset = useCallback(() => {
    setEvents([])
  }, [])

  useEffect(() => {
    return () => {
      esRef.current?.close()
    }
  }, [])

  return { events, status, connect, disconnect, reset }
}
