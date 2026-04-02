import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSSE, SceneEvent } from '../../hooks/useSSE'
import { apiFetch } from '../../hooks/useApi'
import { EventStream } from './EventStream'
import { AuditLog } from './AuditLog'

interface PendingApproval {
  id: string
  sceneId: string
  request: { userId: string; intent: string; batchCount: number; totalAmount: number }
  gateResult: { risk: string; totalAmount: number }
  createdAt: number
}

// ─── Approval Panel ───────────────────────────────────────────────────────────

const ApprovalPanel: React.FC<{
  approval: PendingApproval
  onDecision: (id: string, decision: 'APPROVED' | 'REJECTED') => void
  deciding: boolean
}> = ({ approval, onDecision, deciding }) => {
  const elapsed = Math.round((Date.now() - approval.createdAt) / 1000)

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border p-4 mb-4"
      style={{ borderColor: '#fbbf24', background: '#2a2500' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-yellow-400 text-lg">⚠️</span>
        <span className="text-yellow-300 font-semibold text-sm">待人工审批</span>
        <span className="ml-auto text-xs text-yellow-600 font-mono">{elapsed}s ago</span>
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">意图:</span>
          <span className="text-slate-200">{approval.request.intent}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">批量:</span>
          <span className="text-slate-200">{approval.request.batchCount} 张</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">总金额:</span>
          <span className="text-red-300 font-bold">¥{approval.gateResult.totalAmount.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">风险:</span>
          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
            🔴 {approval.gateResult.risk}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onDecision(approval.id, 'APPROVED')}
          disabled={deciding}
          className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: deciding ? '#10b98140' : '#10b981',
            color: deciding ? '#10b981' : '#0f1117',
          }}
        >
          ✅ 批准
        </button>
        <button
          onClick={() => onDecision(approval.id, 'REJECTED')}
          disabled={deciding}
          className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all border border-red-500/50 text-red-400 hover:bg-red-500/10"
        >
          ❌ 拒绝
        </button>
      </div>
    </motion.div>
  )
}

// ─── Scene 2 Component ────────────────────────────────────────────────────────

const Scene2: React.FC = () => {
  const clientId = `client_2_${Date.now()}`
  const { events, status, connect, disconnect, reset } = useSSE('2', clientId)
  const [running, setRunning] = useState(false)
  const [batchCount, setBatchCount] = useState(500)
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [deciding, setDeciding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Poll for pending approvals
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const { pending } = await apiFetch<{ pending: PendingApproval[] }>('/api/scene/2/pending')
        setPendingApprovals(pending)
      } catch {
        // ignore
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleRun = useCallback(async () => {
    setError(null)
    reset()
    connect()
    await new Promise(r => setTimeout(r, 300))
    setRunning(true)
    try {
      await apiFetch('/api/scene/2/run', {
        method: 'POST',
        body: JSON.stringify({ userId: 'alice', batchCount }),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setRunning(false)
    }
  }, [batchCount, connect, reset])

  const handleReset = useCallback(() => {
    disconnect()
    reset()
    setRunning(false)
    setError(null)
  }, [disconnect, reset])

  const handleDecision = useCallback(async (approvalId: string, decision: 'APPROVED' | 'REJECTED') => {
    setDeciding(true)
    try {
      await apiFetch('/api/scene/2/approve', {
        method: 'POST',
        body: JSON.stringify({ approvalId, decision }),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setDeciding(false)
    }
  }, [])

  const isComplete = events.some(e => e.type === 'complete')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border" style={{ background: '#0f1117' }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="px-2 py-0.5 rounded text-xs font-bold border" style={{ color: '#fbbf24', borderColor: '#fbbf2460', background: '#fbbf2415' }}>
            Scene 2
          </span>
          <h2 className="text-lg font-bold text-slate-100">危险操作 / 人工审批</h2>
        </div>
        <p className="text-sm text-slate-400">高风险意图 → Gate 🔴 CRITICAL → AWAITING_APPROVAL → 人工决策</p>
      </div>

      {/* Main */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left: Events */}
        <div className="flex flex-col" style={{ flex: '0 0 70%', padding: '16px 12px 16px 16px', borderRight: '1px solid #1e2030' }}>
          {/* Approval Panels */}
          <AnimatePresence>
            {pendingApprovals.map(ap => (
              <ApprovalPanel
                key={ap.id}
                approval={ap}
                onDecision={handleDecision}
                deciding={deciding}
              />
            ))}
          </AnimatePresence>

          <EventStream events={events} />
        </div>

        {/* Right: State */}
        <div className="overflow-y-auto" style={{ flex: '0 0 30%', padding: '16px' }}>
          {/* Risk visualization */}
          {events.length > 0 && (
            <div className="rounded-xl p-4 border mb-4" style={{ borderColor: '#ef444450', background: '#2a0a0a' }}>
              <div className="text-xs text-red-400 mb-2 font-medium uppercase tracking-wide">影响范围</div>
              <div className="text-3xl font-bold text-red-300">
                ¥{(batchCount * 30).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">{batchCount} 张 × ¥30</div>
              <div className="mt-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-xs text-red-400 font-bold">CRITICAL</span>
              </div>
            </div>
          )}
          <div className="rounded-xl p-4 border border-border bg-[#0f1117]">
            <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">执行进度</div>
            <div className="text-2xl font-bold" style={{ color: '#20c4cb' }}>{events.length}</div>
            <div className="text-xs text-slate-500">步骤已完成</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 px-6 py-3 border-t border-border flex items-center gap-3" style={{ background: '#0f1117' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">批量:</span>
          <input
            type="number"
            value={batchCount}
            onChange={e => setBatchCount(Number(e.target.value))}
            className="w-20 text-xs px-2 py-1.5 rounded-lg border border-border bg-surface text-slate-200 focus:outline-none focus:border-accent font-mono"
            min={100} max={10000} step={100}
          />
          <span className="text-xs text-slate-500">张</span>
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: running ? '#fbbf2440' : '#fbbf24', color: running ? '#fbbf24' : '#0f1117' }}
        >
          {running ? '⏳' : '▶'} {running ? '运行中...' : '运行'}
        </button>
        <button onClick={handleReset} className="px-3 py-2 rounded-lg text-sm text-slate-400 border border-border hover:border-slate-500">
          ↺ 重置
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
        {isComplete && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-green-400">✅ 完成</motion.span>}
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: status === 'connected' ? '#34d399' : '#4b5563' }} />
          SSE {status}
        </div>
        <div className="ml-2 flex-1 max-w-xs">
          <AuditLog events={events} />
        </div>
      </div>
    </div>
  )
}

export default Scene2
