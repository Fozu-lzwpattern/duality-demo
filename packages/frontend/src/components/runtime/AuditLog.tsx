import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SceneEvent } from '../../hooks/useSSE'

interface AuditEntry {
  id?: string
  sceneId?: string
  userId?: string
  action?: string
  payload?: Record<string, unknown>
  operator?: string
  result?: string
  timestamp?: number
}

interface AuditLogProps {
  events: SceneEvent[]
  rawEntries?: AuditEntry[]
}

function extractAuditEntries(events: SceneEvent[]): AuditEntry[] {
  const entries: AuditEntry[] = []
  for (const ev of events) {
    if (ev.type === 'audit' && ev.data?.auditLog) {
      const log = ev.data.auditLog as AuditEntry[]
      entries.push(...log)
    }
    // Also treat all events as implicit audit trail
  }
  return entries
}

const RESULT_COLOR: Record<string, string> = {
  success: '#34d399',
  failed: '#f87171',
  rolled_back: '#fbbf24',
}

const OPERATOR_BADGE: Record<string, string> = {
  agent: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
  human: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
}

export const AuditLog: React.FC<AuditLogProps> = ({ events, rawEntries }) => {
  const [expanded, setExpanded] = useState(false)

  const entries = rawEntries ?? extractAuditEntries(events)
  // Also add implicit step audit from all events
  const allAudit = events.map((ev, i) => ({
    id: `ev-${i}`,
    action: ev.title,
    payload: ev.data ?? {},
    operator: 'agent' as const,
    result: ev.type === 'error' ? 'failed' : 'success',
    timestamp: ev.timestamp,
  }))

  const displayEntries = entries.length > 0 ? entries : allAudit

  return (
    <div
      className="border border-border rounded-xl overflow-hidden"
      style={{ background: '#0f1117' }}
    >
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-green-400">🔗</span>
          <span className="text-sm font-medium text-slate-200">审计链</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
            {displayEntries.length} 条记录
          </span>
        </div>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-slate-500 text-xs"
        >
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto px-4 pb-4 space-y-2">
              {displayEntries.map((entry, i) => (
                <div
                  key={entry.id ?? i}
                  className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0"
                >
                  <div className="shrink-0 mt-0.5">
                    <span
                      className="w-2 h-2 rounded-full block"
                      style={{ background: RESULT_COLOR[entry.result ?? 'success'] ?? '#94a3b8' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-slate-300 truncate">
                        {entry.action ?? 'UNKNOWN'}
                      </span>
                      {entry.operator && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs border font-medium ${OPERATOR_BADGE[entry.operator] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/40'}`}
                        >
                          {entry.operator}
                        </span>
                      )}
                    </div>
                    {entry.timestamp && (
                      <div className="text-xs text-slate-600 font-mono">
                        {new Date(entry.timestamp).toLocaleTimeString('zh-CN')}
                      </div>
                    )}
                  </div>
                  <div>
                    <span
                      className="text-xs font-medium"
                      style={{ color: RESULT_COLOR[entry.result ?? 'success'] }}
                    >
                      {entry.result ?? 'success'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
