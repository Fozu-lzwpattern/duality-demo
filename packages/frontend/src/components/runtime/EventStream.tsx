import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SceneEvent } from '../../hooks/useSSE'
import { AuditLog } from './AuditLog'

// ─── Icon map ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: string; color: string; border: string; bg: string }> = {
  step:         { icon: '→',   color: '#94a3b8', border: '#2a2d3e', bg: '#1e2030' },
  state_change: { icon: '⬤',   color: '#fbbf24', border: '#fbbf24', bg: '#2a2500' },
  gate_eval:    { icon: '🧠',  color: '#a78bfa', border: '#7c3aed', bg: '#1a1530' },
  contract:     { icon: '📋',  color: '#20c4cb', border: '#20c4cb', bg: '#0a2028' },
  audit:        { icon: '🔗',  color: '#34d399', border: '#10b981', bg: '#0a2820' },
  error:        { icon: '❌',  color: '#f87171', border: '#ef4444', bg: '#2a0a0a' },
  complete:     { icon: '✅',  color: '#34d399', border: '#10b981', bg: '#0a2820' },
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.step
}

// ─── Single Event Item ─────────────────────────────────────────────────────────

const EventItem: React.FC<{ event: SceneEvent; index: number }> = ({ event, index }) => {
  const cfg = getTypeConfig(event.type)
  const time = new Date(event.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
      className="relative flex gap-3"
    >
      {/* Connector line */}
      {index > 0 && (
        <div
          className="absolute left-[17px] -top-3 w-0.5 h-3"
          style={{ background: cfg.border + '60' }}
        />
      )}

      {/* Step badge */}
      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold border-2 z-10"
        style={{
          color: cfg.color,
          borderColor: cfg.border,
          background: cfg.bg,
        }}
      >
        {event.step}
      </div>

      {/* Content */}
      <div
        className="flex-1 rounded-xl p-3 border mb-2"
        style={{ borderColor: cfg.border + '40', background: cfg.bg }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold" style={{ color: cfg.color }}>
            {event.title}
          </span>
          <span className="text-xs font-mono opacity-50">{time}</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{event.description}</p>

        {/* Data payload preview */}
        {event.data && Object.keys(event.data).length > 0 && (
          <details className="mt-2 cursor-pointer">
            <summary className="text-xs text-slate-500 hover:text-slate-400">展开数据</summary>
            <pre className="mt-1 text-xs text-slate-500 font-mono bg-black/20 rounded p-2 overflow-x-auto">
              {JSON.stringify(event.data, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main EventStream ──────────────────────────────────────────────────────────

interface EventStreamProps {
  events: SceneEvent[]
  auditEntries?: Record<string, unknown>[]
}

export const EventStream: React.FC<EventStreamProps> = ({ events, auditEntries = [] }) => {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-30">⚡</div>
          <p className="text-sm">点击「▶ 运行」启动场景</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      {events.map((ev, i) => (
        <EventItem key={`${ev.step}-${i}`} event={ev} index={i} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
