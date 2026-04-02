import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSSE, SceneEvent } from '../../hooks/useSSE'
import { apiFetch } from '../../hooks/useApi'
import { ContractNegotiation } from './ContractNegotiation'
import { AuditLog } from './AuditLog'

const USERS = [
  { id: 'alice', name: 'Alice 💎', desc: 'LTV 92 · 高价值' },
  { id: 'bob', name: 'Bob 🆕', desc: 'LTV 12 · 新用户' },
  { id: 'carol', name: 'Carol ⚡', desc: 'LTV 61 · 高频低客单' },
  { id: 'david', name: 'David 🏨', desc: 'LTV 88 · 多业务重度' },
  { id: 'eva', name: 'Eva 🌱', desc: 'LTV 55 · 成长型' },
]

const Scene4: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState('alice')
  const [runMode, setRunMode] = useState<'auto' | 'manual'>('auto')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clientId = `client_4_${Date.now()}`
  const { events, status, connect, disconnect, reset } = useSSE('4', clientId)

  const handleRun = useCallback(async () => {
    setError(null)
    reset()
    connect()
    await new Promise(r => setTimeout(r, 300))
    setRunning(true)
    try {
      await apiFetch('/scene/4/run', {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedUser,
          intent: '日料，150以内，今晚',
          mode: runMode, // 'auto' | 'manual'
          // In manual mode, backend pauses at draft v1 waiting for POST /api/scene/4/respond
        }),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setRunning(false)
    }
  }, [selectedUser, runMode, connect, reset])

  const handleReset = useCallback(() => {
    disconnect()
    reset()
    setRunning(false)
    setError(null)
  }, [disconnect, reset])

  const isComplete = events.some(e => e.type === 'complete')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border" style={{ background: '#0f1117' }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="px-2 py-0.5 rounded text-xs font-bold border"
            style={{ color: '#a78bfa', borderColor: '#a78bfa60', background: '#a78bfa15' }}>
            Scene 4
          </span>
          <h2 className="text-lg font-bold text-slate-100">合约经济</h2>
        </div>
        <p className="text-sm text-slate-400">
          asC × asB 协商引擎 · 因人而异的动态让利 · NEGOTIATING → STRIKE → FULFILLED
        </p>

        {/* Controls row */}
        <div className="flex items-center gap-4 mt-3">
          {/* User picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">当前用户:</span>
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-lg border border-border bg-surface text-slate-200 focus:outline-none focus:border-accent"
            >
              {USERS.map(u => (
                <option key={u.id} value={u.id}>{u.name} — {u.desc}</option>
              ))}
            </select>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-bg border border-border rounded-lg p-1">
            <button
              onClick={() => setRunMode('auto')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                runMode === 'auto'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              ▶ 自动
            </button>
            <button
              onClick={() => setRunMode('manual')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                runMode === 'manual'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              🖐 手动
            </button>
          </div>

          {runMode === 'manual' && (
            <span className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-lg">
              手动模式：草案出现后点击「接受/反询」
            </span>
          )}
        </div>
      </div>

      {/* Main: ContractNegotiation */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {events.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <div className="text-5xl mb-4 opacity-30">📋</div>
              <p className="text-sm">点击「▶ 运行」启动合约协商</p>
              <p className="text-xs mt-1 text-slate-600">
                {runMode === 'manual' ? '手动模式：在草案出现后点击按钮推进' : '自动模式：全流程自动完成'}
              </p>
            </div>
          </div>
        ) : (
          <ContractNegotiation events={events as any} mode={runMode} />
        )}
      </div>

      {/* Toolbar */}
      <div className="shrink-0 px-6 py-3 border-t border-border flex items-center gap-3" style={{ background: '#0f1117' }}>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: running ? '#a78bfa40' : '#a78bfa',
            color: running ? '#a78bfa' : '#0f1117',
          }}
        >
          {running ? '⏳' : '▶'} {running ? '协商中...' : '运行'}
        </button>

        <button
          onClick={handleReset}
          disabled={running}
          className="px-3 py-2 rounded-lg text-sm text-slate-400 border border-border hover:border-slate-500 transition-all"
        >
          ↺ 重置
        </button>

        {error && <span className="text-xs text-red-400">{error}</span>}
        {isComplete && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-xs text-green-400 font-medium"
          >
            ✅ 协商完成
          </motion.span>
        )}

        <div className="ml-auto flex items-center gap-2 text-xs text-slate-600">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: status === 'connected' ? '#34d399' : status === 'connecting' ? '#fbbf24' : '#4b5563' }}
          />
          SSE {status}
        </div>

        <div className="ml-2 flex-1 max-w-xs">
          <AuditLog events={events} />
        </div>
      </div>
    </div>
  )
}

export default Scene4
