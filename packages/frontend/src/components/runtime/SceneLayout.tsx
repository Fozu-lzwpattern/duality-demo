import React, { useCallback, useId, useState } from 'react'
import { motion } from 'framer-motion'
import { useSSE, SceneEvent } from '../../hooks/useSSE'
import { apiFetch } from '../../hooks/useApi'
import { EventStream } from './EventStream'
import { AuditLog } from './AuditLog'

// ─── State Panel ──────────────────────────────────────────────────────────────

interface StatePanelProps {
  events: SceneEvent[]
}

const STATE_ORDER = ['PENDING', 'ENRICHING', 'GATE_CHECKING', 'AWAITING_APPROVAL', 'EXECUTING', 'NEGOTIATING', 'STRIKE', 'COMPLETED', 'FULFILLED', 'ROLLING_BACK', 'CANCELLED', 'FAILED']

const STATE_COLOR: Record<string, string> = {
  PENDING:            '#94a3b8',
  ENRICHING:          '#60a5fa',
  GATE_CHECKING:      '#a78bfa',
  AWAITING_APPROVAL:  '#fbbf24',
  EXECUTING:          '#20c4cb',
  NEGOTIATING:        '#fbbf24',
  STRIKE:             '#60a5fa',
  COMPLETED:          '#34d399',
  FULFILLED:          '#34d399',
  ROLLING_BACK:       '#fb923c',
  CANCELLED:          '#94a3b8',
  FAILED:             '#f87171',
}

function extractCurrentState(events: SceneEvent[]): string {
  // Find last state_change or contract event
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]
    if (ev.type === 'state_change' && ev.data?.status) {
      return String(ev.data.status)
    }
    if (ev.type === 'complete') return 'FULFILLED'
  }
  if (events.length > 0) return 'EXECUTING'
  return 'IDLE'
}

function extractGateResults(events: SceneEvent[]): SceneEvent[] {
  return events.filter(e => e.type === 'gate_eval')
}

const StatePanel: React.FC<StatePanelProps> = ({ events }) => {
  const currentState = extractCurrentState(events)
  const gateResults = extractGateResults(events)
  const lastEvent = events[events.length - 1]

  return (
    <div className="space-y-4">
      {/* Current State */}
      <div
        className="rounded-xl p-4 border"
        style={{ background: '#0f1117', borderColor: (STATE_COLOR[currentState] ?? '#94a3b8') + '50' }}
      >
        <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">当前状态</div>
        <div className="flex items-center gap-2">
          <motion.div
            className="w-3 h-3 rounded-full"
            style={{ background: STATE_COLOR[currentState] ?? '#94a3b8' }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
          <span className="font-mono font-bold" style={{ color: STATE_COLOR[currentState] ?? '#94a3b8' }}>
            {currentState}
          </span>
        </div>
      </div>

      {/* Gate Results */}
      {gateResults.length > 0 && (
        <div className="rounded-xl p-4 border border-purple-500/20 bg-[#1a1530]">
          <div className="text-xs text-purple-400 mb-2 font-medium uppercase tracking-wide">Gate 评估</div>
          <div className="space-y-2">
            {gateResults.map((ev, i) => (
              <div key={i} className="text-xs text-slate-400">{ev.description}</div>
            ))}
          </div>
        </div>
      )}

      {/* Latest Data */}
      {lastEvent?.data && Object.keys(lastEvent.data).length > 0 && (
        <div className="rounded-xl p-4 border border-border bg-[#0f1117]">
          <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">最新数据</div>
          <pre className="text-xs text-slate-500 font-mono overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(lastEvent.data, null, 2).slice(0, 400)}
          </pre>
        </div>
      )}

      {/* Progress: step count */}
      {events.length > 0 && (
        <div className="rounded-xl p-4 border border-border bg-[#0f1117]">
          <div className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">执行进度</div>
          <div className="text-2xl font-bold" style={{ color: '#20c4cb' }}>
            {events.length}
          </div>
          <div className="text-xs text-slate-500">步骤已完成</div>
        </div>
      )}
    </div>
  )
}

// ─── SceneLayout ─────────────────────────────────────────────────────────────

export interface SceneLayoutProps {
  sceneId: string
  title: string
  subtitle: string
  badge: string
  badgeColor?: string
  runEndpoint: string
  runBody?: () => Record<string, unknown>
  /** Extra controls to show in toolbar (e.g. user picker) */
  extraControls?: React.ReactNode
  /** Override for custom main content (Scene 4 uses this) */
  children?: (events: SceneEvent[], run: () => void, reset: () => void, status: string) => React.ReactNode
}

export const SceneLayout: React.FC<SceneLayoutProps> = ({
  sceneId,
  title,
  subtitle,
  badge,
  badgeColor = '#20c4cb',
  runEndpoint,
  runBody,
  extraControls,
  children,
}) => {
  const clientId = `client_${sceneId}_${Date.now()}`
  const { events, status, connect, disconnect, reset } = useSSE(sceneId, clientId)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRun = useCallback(async () => {
    setError(null)
    reset()
    connect()
    // Small delay to ensure SSE is connected
    await new Promise(r => setTimeout(r, 300))
    setRunning(true)
    try {
      const body = runBody ? runBody() : {}
      await apiFetch(runEndpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setRunning(false)
    }
  }, [connect, reset, runEndpoint, runBody])

  const handleReset = useCallback(() => {
    disconnect()
    reset()
    setError(null)
    setRunning(false)
  }, [disconnect, reset])

  const isComplete = events.some(e => e.type === 'complete')
  const hasError = events.some(e => e.type === 'error')

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Header */}
      <div
        className="shrink-0 px-6 py-4 border-b border-border"
        style={{ background: '#0f1117' }}
      >
        <div className="flex items-center gap-3 mb-1">
          <span
            className="px-2 py-0.5 rounded text-xs font-bold border"
            style={{ color: badgeColor, borderColor: badgeColor + '60', background: badgeColor + '15' }}
          >
            {badge}
          </span>
          <h2 className="text-lg font-bold text-slate-100">{title}</h2>
        </div>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>

      {/* Main content */}
      {children ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          {children(events, handleRun, handleReset, status)}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex gap-0 overflow-hidden">
          {/* Left: Event Stream (70%) */}
          <div className="flex flex-col" style={{ flex: '0 0 70%', minWidth: 0, padding: '16px 12px 16px 16px', borderRight: '1px solid #1e2030' }}>
            <EventStream events={events} />
          </div>

          {/* Right: State Panel (30%) */}
          <div className="overflow-y-auto" style={{ flex: '0 0 30%', padding: '16px' }}>
            <StatePanel events={events} />
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div
        className="shrink-0 px-6 py-3 border-t border-border flex items-center gap-3"
        style={{ background: '#0f1117' }}
      >
        {extraControls}

        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: running ? '#20c4cb40' : '#20c4cb',
            color: running ? '#20c4cb' : '#0f1117',
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? '⏳' : '▶'} {running ? '运行中...' : '运行'}
        </button>

        <button
          onClick={handleReset}
          disabled={running}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 border border-border hover:border-slate-500 transition-all"
        >
          ↺ 重置
        </button>

        {error && (
          <span className="text-xs text-red-400 font-mono">{error}</span>
        )}

        {isComplete && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-xs text-green-400 font-medium ml-2"
          >
            ✅ 完成
          </motion.span>
        )}

        {/* SSE Status indicator */}
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-600">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: status === 'connected' ? '#34d399' : status === 'connecting' ? '#fbbf24' : '#4b5563'
            }}
          />
          SSE {status}
        </div>

        {/* Audit log toggle */}
        <div className="ml-2 flex-1 max-w-xs">
          <AuditLog events={events} />
        </div>
      </div>
    </div>
  )
}
