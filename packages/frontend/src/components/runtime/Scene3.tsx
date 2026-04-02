import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SceneLayout } from './SceneLayout'
import { EventStream } from './EventStream'
import { AuditLog } from './AuditLog'
import { useSSE } from '../../hooks/useSSE'
import { apiFetch } from '../../hooks/useApi'

// ─── Saga Visualizer ──────────────────────────────────────────────────────────

const SAGA_STEPS = [
  { name: '扣减积分', system: '积分系统', icon: '🪙' },
  { name: '锁定库存', system: '库存系统', icon: '📦' },
  { name: '写入订单预留', system: '订单系统', icon: '📝' },
  { name: '发放优惠券', system: '券系统', icon: '🎟️' },
]

type StepState = 'idle' | 'executing' | 'success' | 'failed' | 'compensated'

const STEP_STYLE: Record<StepState, { border: string; bg: string; text: string }> = {
  idle:        { border: '#2a2d3e', bg: '#1e2030', text: '#64748b' },
  executing:   { border: '#20c4cb', bg: '#0a2028', text: '#20c4cb' },
  success:     { border: '#10b981', bg: '#0a2820', text: '#34d399' },
  failed:      { border: '#ef4444', bg: '#2a0a0a', text: '#f87171' },
  compensated: { border: '#fbbf24', bg: '#2a2500', text: '#fbbf24' },
}

interface SagaStepState {
  state: StepState
  label: string
}

function computeSagaStates(events: Array<{ type: string; title: string; step: number }>): SagaStepState[] {
  const states: SagaStepState[] = SAGA_STEPS.map(s => ({ state: 'idle' as StepState, label: '' }))
  for (const ev of events) {
    for (let i = 0; i < SAGA_STEPS.length; i++) {
      const stepName = SAGA_STEPS[i].name
      if (ev.title.includes(stepName)) {
        if (ev.title.includes('✅')) states[i] = { state: 'success', label: '✅ 成功' }
        else if (ev.title.includes('❌')) states[i] = { state: 'failed', label: '❌ 失败' }
        else if (ev.title.includes('↩️') || ev.title.includes('补偿')) states[i] = { state: 'compensated', label: '↩️ 已补偿' }
        else states[i] = { state: 'executing', label: '⏳ 执行中' }
      }
    }
  }
  return states
}

const SagaVisualizer: React.FC<{ events: Array<{ type: string; title: string; step: number }> }> = ({ events }) => {
  const sagaStates = computeSagaStates(events)
  const isRollingBack = events.some(e => e.title.includes('补偿') || e.title.includes('回滚'))

  return (
    <div className="rounded-xl p-4 border border-border bg-[#0f1117] mb-4">
      <div className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wide">Saga 执行图</div>
      <div className="space-y-2">
        {SAGA_STEPS.map((step, i) => {
          const s = sagaStates[i]
          const style = STEP_STYLE[s.state]
          return (
            <motion.div
              key={step.name}
              className="flex items-center gap-3 p-2.5 rounded-lg border transition-all"
              style={{ borderColor: style.border, background: style.bg }}
              animate={{ borderColor: style.border }}
              transition={{ duration: 0.3 }}
            >
              <span className="text-base">{step.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium" style={{ color: style.text }}>
                  {step.name}
                </div>
                <div className="text-xs text-slate-600">{step.system}</div>
              </div>
              {s.label && (
                <span className="text-xs font-medium" style={{ color: style.text }}>
                  {s.label}
                </span>
              )}
            </motion.div>
          )
        })}
      </div>
      {isRollingBack && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-2 text-xs text-yellow-400"
        >
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          >
            🔄
          </motion.span>
          Saga 补偿回滚中...
        </motion.div>
      )}
    </div>
  )
}

// ─── Scene 3 Component ────────────────────────────────────────────────────────

const Scene3: React.FC = () => {
  const clientId = `client_3_${Date.now()}`
  const { events, status, connect, disconnect, reset } = useSSE('3', clientId)
  const [running, setRunning] = useState(false)
  const [failAtStep, setFailAtStep] = useState(3)
  const [error, setError] = useState<string | null>(null)

  const handleRun = async () => {
    setError(null)
    reset()
    connect()
    await new Promise(r => setTimeout(r, 300))
    setRunning(true)
    try {
      await apiFetch('/api/scene/3/run', {
        method: 'POST',
        body: JSON.stringify({ userId: 'alice', failAtStep }),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setRunning(false)
    }
  }

  const handleReset = () => {
    disconnect(); reset(); setRunning(false); setError(null)
  }

  const isComplete = events.some(e => e.type === 'complete')
  const isRolledBack = events.some(e => e.title.includes('回滚完成'))

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-border" style={{ background: '#0f1117' }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="px-2 py-0.5 rounded text-xs font-bold border" style={{ color: '#fb923c', borderColor: '#fb923c60', background: '#fb923c15' }}>
            Scene 3
          </span>
          <h2 className="text-lg font-bold text-slate-100">跨系统 Saga 事务</h2>
        </div>
        <p className="text-sm text-slate-400">多系统操作 → 中途失败 → Saga 补偿回滚 → 系统一致性保证</p>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex flex-col" style={{ flex: '0 0 70%', padding: '16px 12px 16px 16px', borderRight: '1px solid #1e2030' }}>
          <EventStream events={events} />
        </div>
        <div className="overflow-y-auto" style={{ flex: '0 0 30%', padding: '16px' }}>
          <SagaVisualizer events={events} />
          {isRolledBack && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/5 mb-4"
            >
              <div className="text-yellow-400 font-semibold text-sm mb-1">✅ 事务一致性保证</div>
              <div className="text-xs text-slate-400">所有已执行步骤已补偿，系统回到初始状态</div>
            </motion.div>
          )}
          <div className="rounded-xl p-4 border border-border bg-[#0f1117]">
            <div className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">执行进度</div>
            <div className="text-2xl font-bold" style={{ color: '#20c4cb' }}>{events.length}</div>
            <div className="text-xs text-slate-500">步骤已完成</div>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-6 py-3 border-t border-border flex items-center gap-3" style={{ background: '#0f1117' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">失败于第:</span>
          <select
            value={failAtStep}
            onChange={e => setFailAtStep(Number(e.target.value))}
            className="text-xs px-2 py-1.5 rounded-lg border border-border bg-surface text-slate-200 focus:outline-none"
          >
            {[1, 2, 3, 4].map(n => (
              <option key={n} value={n}>步骤 {n}</option>
            ))}
          </select>
          <span className="text-xs text-slate-500">步</span>
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: running ? '#fb923c40' : '#fb923c', color: running ? '#fb923c' : '#0f1117' }}
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

export default Scene3
