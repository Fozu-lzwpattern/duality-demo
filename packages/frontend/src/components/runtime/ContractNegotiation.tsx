import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SceneEvent } from '../../hooks/useSSE'
import { apiFetch } from '../../hooks/useApi'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContractTerms {
  discount: number
  maxBenefit: number
  validWindow: string
  note?: string
}

interface ContractEvent extends SceneEvent {
  data?: {
    round?: number
    proposal?: ContractTerms
    contractId?: string
    maxAllowed?: number
    waitingForUser?: boolean
    ltv?: number
    timeSlot?: string
    supply?: string
    tier?: string
    userName?: string
    status?: string
    [key: string]: unknown
  }
}

// ─── Contract Status Progress ─────────────────────────────────────────────────

const STATUS_FLOW = ['PENDING', 'NEGOTIATING', 'STRIKE', 'FULFILLED'] as const
type ContractStatus = typeof STATUS_FLOW[number] | 'REJECTED' | 'EXPIRED'

const STATUS_COLOR: Record<string, string> = {
  PENDING:     '#94a3b8',
  NEGOTIATING: '#fbbf24',
  STRIKE:      '#60a5fa',
  FULFILLED:   '#34d399',
  REJECTED:    '#f87171',
}

const ContractProgress: React.FC<{ status: ContractStatus }> = ({ status }) => {
  const isRejected = status === 'REJECTED' || status === 'EXPIRED'
  const activeIdx = STATUS_FLOW.indexOf(status as typeof STATUS_FLOW[number])

  return (
    <div className="px-4 py-3 border-t border-border" style={{ background: '#0f1117' }}>
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {STATUS_FLOW.map((s, i) => {
          const active = s === status
          const passed = !isRejected && i < (activeIdx >= 0 ? activeIdx : 0)
          const color = passed || active ? STATUS_COLOR[s] : '#2a2d3e'
          return (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1">
                <motion.div
                  className="w-4 h-4 rounded-full border-2"
                  style={{ borderColor: color, background: (active || passed) ? color : 'transparent' }}
                  animate={active ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ repeat: active ? Infinity : 0, duration: 1.5 }}
                />
                <span className="text-xs font-mono" style={{ color }}>
                  {s}
                </span>
              </div>
              {i < STATUS_FLOW.length - 1 && (
                <div
                  className="flex-1 h-0.5 mx-1 rounded"
                  style={{ background: passed ? STATUS_COLOR[STATUS_FLOW[i + 1]] : '#2a2d3e' }}
                />
              )}
            </React.Fragment>
          )
        })}
        {isRejected && (
          <div className="ml-4 px-2 py-1 rounded bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold">
            {status}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Contract Draft Card ──────────────────────────────────────────────────────

const ContractCard: React.FC<{ terms: ContractTerms; version: number; side: 'left' | 'right' }> = ({
  terms, version, side
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.85, x: side === 'left' ? -20 : 20 }}
    animate={{ opacity: 1, scale: 1, x: 0 }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    className="rounded-xl border p-3 my-2"
    style={{ borderColor: '#20c4cb', background: '#0a2028' }}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-bold text-cyan-400">草案 v{version}</span>
      {terms.note && (
        <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
          ⚠️ {terms.note}
        </span>
      )}
    </div>
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-white">{Math.round(terms.discount * 100)}折</span>
        <span className="text-slate-400 text-sm">最高优惠</span>
        <span className="text-xl font-bold text-cyan-300">¥{terms.maxBenefit}</span>
      </div>
      <div className="text-xs text-slate-500">{terms.validWindow}</div>
    </div>
  </motion.div>
)

// ─── Chat Bubble ──────────────────────────────────────────────────────────────

const Bubble: React.FC<{
  text: string
  side: 'left' | 'right'
  icon?: string
  color?: string
}> = ({ text, side, icon = '💬', color = '#20c4cb' }) => (
  <motion.div
    initial={{ opacity: 0, x: side === 'left' ? -20 : 20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.3 }}
    className={`flex items-start gap-2 my-2 ${side === 'right' ? 'flex-row-reverse' : ''}`}
  >
    <span className="text-base shrink-0 mt-0.5">{icon}</span>
    <div
      className="rounded-xl px-3 py-2 text-sm max-w-[200px] border"
      style={{
        background: color + '15',
        borderColor: color + '40',
        color: '#e2e8f0',
      }}
    >
      {text}
    </div>
  </motion.div>
)

// ─── Evaluation Checklist ────────────────────────────────────────────────────

const EvalChecklist: React.FC<{ ltv: number; timeSlot: string; supply: string }> = ({
  ltv, timeSlot, supply
}) => {
  const items = [
    { label: `LTV: ${ltv}`, ok: true },
    { label: timeSlot, ok: true },
    { label: `供给: ${supply}`, ok: true },
  ]
  return (
    <div className="space-y-1 my-2">
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.3 }}
          className="flex items-center gap-2 text-xs"
        >
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.3 + 0.15, type: 'spring' }}
            className="text-green-400"
          >
            ✓
          </motion.span>
          <span className="text-slate-300">{item.label}</span>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Counter Offer Input ──────────────────────────────────────────────────────

const CounterOfferInput: React.FC<{
  contractId: string
  onSubmit: (action: 'ACCEPT' | 'COUNTER' | 'REJECT', text?: string) => void
}> = ({ contractId, onSubmit }) => {
  const [counterText, setCounterText] = useState('能不能再多 ¥6？')
  const [showInput, setShowInput] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (action: 'ACCEPT' | 'COUNTER' | 'REJECT', text?: string) => {
    setSubmitting(true)
    try {
      await apiFetch('/api/scene/4/respond', {
        method: 'POST',
        body: JSON.stringify({ contractId, action, counterText: text }),
      })
      onSubmit(action, text)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 space-y-2"
    >
      {!showInput ? (
        <div className="flex gap-2">
          <button
            onClick={() => submit('ACCEPT')}
            disabled={submitting}
            className="flex-1 py-2 rounded-lg text-xs font-semibold border border-green-500/40 text-green-400 hover:bg-green-500/10 transition-all"
          >
            ✅ 接受
          </button>
          <button
            onClick={() => setShowInput(true)}
            disabled={submitting}
            className="flex-1 py-2 rounded-lg text-xs font-semibold border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all"
          >
            ❌ 反询
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={counterText}
            onChange={e => setCounterText(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg border border-cyan-500/40 bg-[#0a2028] text-slate-200 focus:outline-none focus:border-cyan-400"
            placeholder="输入反询内容..."
          />
          <div className="flex gap-2">
            <button
              onClick={() => submit('COUNTER', counterText)}
              disabled={submitting || !counterText}
              className="flex-1 py-2 rounded-lg text-xs font-semibold"
              style={{ background: '#20c4cb', color: '#0f1117' }}
            >
              发出反询
            </button>
            <button
              onClick={() => setShowInput(false)}
              className="px-3 py-2 rounded-lg text-xs text-slate-400 border border-border"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Main ContractNegotiation Component ──────────────────────────────────────

interface Props {
  events: ContractEvent[]
  mode: 'auto' | 'manual'
}

export const ContractNegotiation: React.FC<Props> = ({ events, mode }) => {
  const [respondedRound, setRespondedRound] = useState<number>(0)

  // Extract state from events
  const intentEvent = events.find(e => e.step === 1)
  const evalEvent = events.find(e => e.step === 2)
  const contractEvents = events.filter(e => e.type === 'contract')
  const round1 = contractEvents.find(e => e.data?.round === 1)
  const round2 = contractEvents.find(e => e.data?.round === 2)
  const strikeEvent = events.find(e => e.data?.status === 'STRIKE')
  const fulfilledEvent = events.find(e => e.data?.status === 'FULFILLED')
  const counterEvent = events.find(e => e.step === 4 && e.data?.response === 'COUNTER')
  const rejectEvent = events.find(e => e.data?.status === 'REJECTED')
  const completeEvent = events.find(e => e.type === 'complete')

  const contractId = intentEvent?.data?.contractId as string | undefined

  // Determine current status
  let status: ContractStatus = 'PENDING'
  if (fulfilledEvent) status = 'FULFILLED'
  else if (strikeEvent) status = 'STRIKE'
  else if (rejectEvent) status = 'REJECTED'
  else if (events.length > 0) status = 'NEGOTIATING'

  // Check if waiting for user input
  const waitingR1 = mode === 'manual' && round1 && !counterEvent && !round2 && respondedRound < 1 && status !== 'FULFILLED' && status !== 'REJECTED'
  const waitingR2 = mode === 'manual' && round2 && !fulfilledEvent && respondedRound < 2 && status !== 'REJECTED'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Two-column negotiation area */}
      <div className="flex-1 min-h-0 overflow-hidden flex gap-0">
        {/* Left: asC (Alice 的数字分身) */}
        <div
          className="flex-1 flex flex-col overflow-y-auto px-4 py-4 border-r border-border"
          style={{ background: '#0f1117' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">👤</span>
            <span className="font-semibold text-slate-200 text-sm">asC</span>
            <span className="text-xs text-slate-500">
              ({intentEvent?.data?.userName as string ?? 'Alice'} 的数字分身)
            </span>
          </div>

          <AnimatePresence mode="sync">
            {/* Intent */}
            {intentEvent && (
              <Bubble
                key="intent"
                text={`"${intentEvent?.data?.intent as string ?? '日料，150以内，今晚'}"`}
                side="left"
                icon="💬"
                color="#20c4cb"
              />
            )}

            {/* Round 1 received */}
            {round1?.data?.proposal && (
              <div key="r1-received">
                <div className="text-xs text-slate-500 mt-2 mb-1">📨 收到草案 v1</div>
                <ContractCard
                  terms={round1.data.proposal as ContractTerms}
                  version={1}
                  side="left"
                />
                {/* Manual mode: show action buttons */}
                {waitingR1 && contractId && (
                  <CounterOfferInput
                    contractId={contractId}
                    onSubmit={(action) => setRespondedRound(1)}
                  />
                )}
              </div>
            )}

            {/* Counter offer */}
            {counterEvent && (
              <Bubble
                key="counter"
                text={counterEvent.data?.counter as string ?? '能不能再多 ¥6？'}
                side="left"
                icon="🔄"
                color="#fbbf24"
              />
            )}

            {/* Round 2 received */}
            {round2?.data?.proposal && (
              <div key="r2-received">
                <div className="text-xs text-slate-500 mt-2 mb-1">📨 收到草案 v2</div>
                <ContractCard
                  terms={round2.data.proposal as ContractTerms}
                  version={2}
                  side="left"
                />
                {waitingR2 && contractId && (
                  <CounterOfferInput
                    contractId={contractId}
                    onSubmit={(action) => setRespondedRound(2)}
                  />
                )}
              </div>
            )}

            {/* Accept */}
            {fulfilledEvent && (
              <Bubble
                key="accept"
                text="✅ 接受合约"
                side="left"
                icon="✅"
                color="#34d399"
              />
            )}

            {/* Complete */}
            {completeEvent && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-3 rounded-xl p-3 border border-green-500/30 bg-green-500/5 text-xs text-green-400"
              >
                🎉 {completeEvent.description}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: asB (美团优惠券系统) */}
        <div
          className="flex-1 flex flex-col overflow-y-auto px-4 py-4"
          style={{ background: '#0c1820' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🤖</span>
            <span className="font-semibold text-slate-200 text-sm">asB</span>
            <span className="text-xs text-slate-500">(美团优惠券系统)</span>
          </div>

          <AnimatePresence mode="sync">
            {/* Evaluation */}
            {evalEvent && (
              <div key="eval">
                <Bubble text="🧠 评估用户画像..." side="right" icon="🧠" color="#a78bfa" />
                <EvalChecklist
                  ltv={evalEvent.data?.ltv as number ?? 92}
                  timeSlot={evalEvent.data?.timeSlot as string ?? '非高峰'}
                  supply={evalEvent.data?.supply as string ?? '充足'}
                />
              </div>
            )}

            {/* Sending draft v1 */}
            {round1?.data?.proposal && (
              <div key="r1-sent">
                <Bubble text="📤 发出草案 v1" side="right" icon="📤" color="#20c4cb" />
                <div className="text-right text-xs text-slate-500 mt-1">
                  {Math.round((round1.data.proposal as ContractTerms).discount * 100)}折，
                  最高优惠 ¥{(round1.data.proposal as ContractTerms).maxBenefit}
                </div>
              </div>
            )}

            {/* Re-evaluating */}
            {counterEvent && (
              <Bubble
                key="re-eval"
                text={`🔄 重新评估... 让利上限: ¥${events.find(e => e.step === 5)?.data?.maxAllowed ?? '?'}`}
                side="right"
                icon="🔄"
                color="#fbbf24"
              />
            )}

            {/* Sending draft v2 */}
            {round2?.data?.proposal && (
              <div key="r2-sent">
                <Bubble text="📤 发出草案 v2" side="right" icon="📤" color="#20c4cb" />
                <div className="text-right text-xs text-slate-500 mt-1">
                  最高优惠 ¥{(round2.data.proposal as ContractTerms).maxBenefit}
                  {(round2.data.proposal as ContractTerms).note && (
                    <span className="ml-1 text-yellow-500">
                      ⚠️ {(round2.data.proposal as ContractTerms).note}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Strike & Mint */}
            {strikeEvent && (
              <Bubble key="strike" text="✅ 合约签约 → STRIKE" side="right" icon="🤝" color="#60a5fa" />
            )}
            {fulfilledEvent && (
              <Bubble
                key="fulfilled"
                text={`🎟️ 券已发放: ${fulfilledEvent.data?.couponId as string ?? ''}`}
                side="right"
                icon="🎟️"
                color="#34d399"
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Contract Status Progress Bar */}
      <ContractProgress status={status} />
    </div>
  )
}
