import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SceneEvent } from '../../hooks/useSSE'
import { apiFetch } from '../../hooks/useApi'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ContractDraft {
  discount: number
  maxBenefit: number
  window: string
  note?: string
}

interface NegotiationEvent extends SceneEvent {
  data?: {
    role?: 'asC' | 'asB'
    intent?: string
    contractId?: string
    userId?: string
    userName?: string
    ltv?: number
    draft?: ContractDraft
    round?: number
    counter?: string
    currentBenefit?: number
    maxAllowed?: number
    waiting?: boolean
    status?: string
    couponId?: string
    finalBenefit?: number
    [key: string]: unknown
  }
}

// ─── Contract Progress Bar ──────────────────────────────────────────────────────

const ContractProgress: React.FC<{
  activeStep: number
  status: string
}> = ({ activeStep, status }) => {
  const steps = ['意图', '评估', '草案v1', '协商', '草案v2', '成交', '履约']
  return (
    <div className="px-4 py-3 border-t border-border" style={{ background: '#0f1117' }}>
      <div className="flex items-center gap-1">
        {steps.map((label, i) => {
          const done = i < activeStep
          const active = i === activeStep - 1
          const color = done ? '#34d399' : active ? '#fbbf24' : '#2a2d3e'
          return (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-0.5 flex-1">
                <div
                  className="w-2 h-2 rounded-full transition-all"
                  style={{ background: color }}
                />
                <span className="text-xs font-medium" style={{ color }}>
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="h-0.5 flex-1 rounded mb-3" style={{ background: done ? '#34d399' : '#2a2d3e' }} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ─── Draft Card ────────────────────────────────────────────────────────────────

const DraftCard: React.FC<{
  draft: ContractDraft
  version: number
  note?: string
  side: 'left' | 'right'
}> = ({ draft, version, side }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.85, x: side === 'left' ? -16 : 16 }}
    animate={{ opacity: 1, scale: 1, x: 0 }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    className="rounded-xl border p-3 my-2"
    style={{ borderColor: '#20c4cb60', background: '#0a2028' }}
  >
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-xs font-bold text-cyan-400">草案 v{version}</span>
      {draft.note && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
          ⚠️ {draft.note}
        </span>
      )}
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xl font-bold text-white">{Math.round(draft.discount * 100)}折</span>
      <span className="text-slate-400 text-sm">最高</span>
      <span className="text-lg font-bold text-cyan-300">¥{draft.maxBenefit}</span>
    </div>
    <div className="text-xs text-slate-500 mt-1">{draft.window}</div>
  </motion.div>
)

// ─── Chat Bubble ───────────────────────────────────────────────────────────────

const Bubble: React.FC<{
  text: string
  side: 'left' | 'right'
  icon: string
  color?: string
  bold?: boolean
}> = ({ text, side, icon, color = '#20c4cb', bold }) => (
  <motion.div
    initial={{ opacity: 0, x: side === 'left' ? -12 : 12 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.25 }}
    className={`flex items-start gap-2 my-1.5 ${side === 'right' ? 'flex-row-reverse' : ''}`}
  >
    <span className="text-sm shrink-0 mt-0.5">{icon}</span>
    <div
      className="rounded-xl px-3 py-2 text-xs max-w-[180px] border leading-relaxed"
      style={{
        background: color + '15',
        borderColor: color + '40',
        color: bold ? color : '#cbd5e1',
        fontWeight: bold ? 600 : 400,
      }}
    >
      {text}
    </div>
  </motion.div>
)

// ─── User Action Buttons (manual mode) ─────────────────────────────────────────

const UserAction: React.FC<{
  contractId: string
  onResponded: () => void
}> = ({ contractId, onResponded }) => {
  const [showCounter, setShowCounter] = useState(false)
  const [counterText, setCounterText] = useState('能不能再多 ¥6？')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (action: 'accept' | 'counter' | 'reject') => {
    setSubmitting(true)
    try {
      await apiFetch('/scene/4/respond', {
        method: 'POST',
        body: JSON.stringify({
          contractId,
          action,
          counterText: action === 'counter' ? counterText : undefined,
        }),
      })
      onResponded()
    } finally {
      setSubmitting(false)
    }
  }

  if (showCounter) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border p-3 my-2"
        style={{ borderColor: '#fbbf2460', background: '#2a2500' }}
      >
        <div className="text-xs text-yellow-400 mb-2">🔄 反询内容：</div>
        <input
          value={counterText}
          onChange={e => setCounterText(e.target.value)}
          className="w-full text-xs px-3 py-2 rounded-lg border border-yellow-500/40 bg-[#0f1117] text-slate-200 focus:outline-none focus:border-yellow-400 mb-2"
        />
        <div className="flex gap-2">
          <button
            onClick={() => submit('counter')}
            disabled={submitting}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-black bg-yellow-400 hover:bg-yellow-300 transition-colors"
          >
            发出反询
          </button>
          <button
            onClick={() => setShowCounter(false)}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-border"
          >
            取消
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2 my-2"
    >
      <button
        onClick={() => submit('accept')}
        disabled={submitting}
        className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all"
        style={{ borderColor: '#10b98160', color: '#34d399', background: '#10b98115' }}
      >
        ✅ 接受
      </button>
      <button
        onClick={() => setShowCounter(true)}
        className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all"
        style={{ borderColor: '#fbbf2460', color: '#fbbf24', background: '#fbbf2415' }}
      >
        ❌ 反询
      </button>
      <button
        onClick={() => submit('reject')}
        className="px-3 py-2 rounded-lg text-xs border transition-all"
        style={{ borderColor: '#ef444460', color: '#f87171', background: '#ef444415' }}
      >
        拒绝
      </button>
    </motion.div>
  )
}

// ─── Main ContractNegotiation ──────────────────────────────────────────────────

export const ContractNegotiation: React.FC<{
  events: NegotiationEvent[]
  mode: 'auto' | 'manual'
}> = ({ events, mode }) => {
  // Extract events
  // Step mapping matches actual backend SSE sequence:
  // step 1: asC 意图 (type:'contract', role:'asC', type:'intent')
  // step 2: asB 评估 (type:'contract', role:'asB', evaluating:true)  
  // step 3: 草案v1 (type:'contract', role:'asB', draft:{...}, round:1)
  // step 3 AGAIN: ⏸ 等待 (data.waiting:true) — manual mode only
  // step 4: asC 反询 (type:'contract', role:'asC', type:'counter') OR accept
  // step 5: asB 重评估 (type:'contract', role:'asB', formula:...)
  // step 6: 草案v2 (type:'contract', role:'asB', draft:{...}, round:2)
  // step 7: asC 接受 → STRIKE (step 7 appears twice)
  // step 8: dynamicMint
  // step 9: ISSUED
  // step 10: audit
  // step 11: complete

  const intentEv = events.find(e => e.step === 1 && e.data?.role === 'asC')
  const evalEv = events.find(e => e.step === 2 && e.data?.role === 'asB')
  const draftV1 = events.find(e => e.step === 3 && e.data?.draft && e.data?.round === 1)
  const waitingEv = events.find(e => e.data?.waiting === true) // manual mode pause
  const counterEv = events.find(e => e.step === 4 && e.data?.type === 'counter')
  const autoAcceptV1 = events.find(e => e.step === 4 && e.data?.decision === 'accept')
  const reevalEv = events.find(e => e.step === 5 && e.data?.formula)
  const draftV2 = events.find(e => e.step === 6 && e.data?.draft && e.data?.round === 2)
  const acceptV2 = events.find(e => e.step === 7 && e.data?.decision === 'accept')
  const strikeEv = events.find(e => e.data?.status === 'STRIKE')
  const mintEv = events.find(e => e.step === 8 && e.data?.minted === 'on-demand')
  const issuedEv = events.find(e => e.step === 9 && e.data?.contractStatus === 'FULFILLED')
  const auditEv = events.find(e => e.step === 10)
  const completeEv = events.find(e => e.type === 'complete')

  // ContractId from intent
  // contractId from step 3 (draft v1 has contractId in waiting event)
  const contractId = (waitingEv?.data?.contractId ?? draftV1?.data?.contractId ?? intentEv?.data?.contractId) as string | undefined

  // Active progress step
  const activeStep = completeEv ? 7
    : strikeEv || issuedEv ? 6
    : acceptV2 || mintEv ? 5
    : draftV2 ? 4
    : counterEv || reevalEv ? 3
    : draftV1 ? 2
    : evalEv ? 1
    : 0

  // Track manual responded
  const [responded, setResponded] = useState(false)
  const waitingForUser = waitingEv && !responded

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Two columns */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Left: asC */}
        <div
          className="flex-1 flex flex-col overflow-y-auto px-4 py-3 border-r border-border"
          style={{ background: '#0f1117' }}
        >
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <span className="text-sm">👤</span>
            <span className="font-semibold text-slate-200 text-sm">asC</span>
            <span className="text-xs text-slate-500">
              ({intentEv?.data?.userName ?? 'Alice'} 的数字分身)
            </span>
          </div>

          <AnimatePresence mode="sync">
            {intentEv && (
              <Bubble
                key="intent"
                text={`"${intentEv.data?.intent ?? '日料，150以内，今晚'}"`}
                side="left"
                icon="💬"
                color="#20c4cb"
                bold
              />
            )}

            {draftV1?.data?.draft && (
              <div key="r1">
                <div className="text-xs text-slate-500 mt-2 mb-0.5">📨 收到草案 v1</div>
                <DraftCard
                  draft={draftV1.data.draft as ContractDraft}
                  version={1}
                  side="left"
                />
                {waitingForUser && contractId && !responded && (
                  <UserAction
                    contractId={contractId}
                    onResponded={() => setResponded(true)}
                  />
                )}
              </div>
            )}

            {autoAcceptV1 && (
              <Bubble
                key="autoaccept"
                text={`✅ 接受草案 v1：¥${autoAcceptV1.data?.draft?.maxBenefit ?? '?'}`}
                side="left"
                icon="✅"
                color="#34d399"
              />
            )}

            {counterEv && (
              <Bubble
                key="counter"
                text={`🔄 ${counterEv.data?.counter ?? '能不能再多¥6？'}`}
                side="left"
                icon="🔄"
                color="#fbbf24"
              />
            )}

            {draftV2?.data?.draft && (
              <div key="r2">
                <div className="text-xs text-slate-500 mt-2 mb-0.5">📨 收到草案 v2</div>
                <DraftCard
                  draft={draftV2.data.draft as ContractDraft}
                  version={2}
                  side="left"
                />
              </div>
            )}

            {acceptV2 && (
              <Bubble
                key="acceptv2"
                text={`✅ 接受草案 v2`}
                side="left"
                icon="✅"
                color="#34d399"
              />
            )}

            {completeEv && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-3 rounded-xl p-3 border border-green-500/30 bg-green-500/5 text-xs text-green-400"
              >
                🎉 {completeEv.description}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: asB */}
        <div
          className="flex-1 flex flex-col overflow-y-auto px-4 py-3"
          style={{ background: '#0c1820' }}
        >
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <span className="text-sm">🤖</span>
            <span className="font-semibold text-slate-200 text-sm">asB</span>
            <span className="text-xs text-slate-500">(美团优惠券系统)</span>
          </div>

          <AnimatePresence mode="sync">
            {evalEv && (
              <div key="eval">
                <Bubble text="🧠 评估用户画像..." side="right" icon="🧠" color="#a78bfa" />
                <div className="ml-8 mt-1 space-y-0.5">
                  {[
                    `LTV: ${evalEv.data?.ltv ?? '?'}`,
                    `时段: ${evalEv.data?.timeSlot ?? '19:00-22:00'}`,
                    `供给评分: ${evalEv.data?.supplyScore ?? '85'}分`,
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.25 }}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <span className="text-green-400">✓</span>
                      <span className="text-slate-300">{item}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {draftV1?.data?.draft && (
              <div key="draftv1">
                <Bubble
                  text={`📤 发出草案 v1: ${Math.round((draftV1.data.draft as ContractDraft).discount * 100)}折 ¥${(draftV1.data.draft as ContractDraft).maxBenefit}`}
                  side="right"
                  icon="📤"
                  color="#20c4cb"
                />
              </div>
            )}

            {reevalEv && (
              <div key="reeval">
                <Bubble
                  text={`🔄 重新评估让利上限: ¥${reevalEv.data?.maxAllowed ?? '?'}`}
                  side="right"
                  icon="🔄"
                  color="#fbbf24"
                />
                <div className="text-right mr-2 mt-1 text-xs text-slate-500 bg-[#0c1820] rounded-lg p-2 border border-border font-mono">
                  <span className="text-yellow-400">{reevalEv.data?.formula as string ?? 'min(LTV×0.4, ¥50)'}</span>
                </div>
              </div>
            )}

            {draftV2?.data?.draft && (
              <div key="draftv2">
                <Bubble
                  text={`📤 发出草案 v2: ¥${(draftV2.data.draft as ContractDraft).maxBenefit}${(draftV2.data.draft as ContractDraft).note ? ' ⚠️' : ''}`}
                  side="right"
                  icon="📤"
                  color="#20c4cb"
                />
              </div>
            )}

            {strikeEv && (
              <Bubble
                key="strike"
                text={`🤝 合约成交 STRIKE: 最终让利 ¥${strikeEv.data?.finalBenefit ?? (strikeEv.data as any)?.finalBenefit ?? '?'}`}
                side="right"
                icon="🤝"
                color="#60a5fa"
              />
            )}

            {mintEv && (
              <Bubble
                key="mint"
                text={`⚡ dynamicMint: ${mintEv.data?.couponId as string ?? ''} ¥${mintEv.data?.discountValue ?? ''}`}
                side="right"
                icon="⚡"
                color="#20c4cb"
              />
            )}

            {issuedEv && (
              <Bubble
                key="issued"
                text={`✅ 合约 FULFILLED: ${issuedEv.data?.couponId as string ?? ''} 已发放`}
                side="right"
                icon="✅"
                color="#34d399"
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Progress */}
      <ContractProgress activeStep={activeStep} status={completeEv ? 'FULFILLED' : 'NEGOTIATING'} />
    </div>
  )
}
