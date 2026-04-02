import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SceneEvent } from '../../hooks/useSSE'
import { apiFetch } from '../../hooks/useApi'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ContractDraft {
  discount?: number
  maxBenefit?: number
  window?: string
  note?: string
  productName?: string
  originalPrice?: number
  description?: string
}

interface NegotiationEvent extends SceneEvent {
  data?: {
    role?: 'asC' | 'asB'
    intent?: string
    contractId?: string
    userId?: string
    userName?: string
    tier?: string
    ltv?: number
    orderCount?: number
    businessTags?: string[]
    timeSlot?: string
    supplyScore?: number
    evaluating?: boolean
    draft?: ContractDraft
    round?: number
    counter?: string
    currentBenefit?: number
    maxAllowed?: number
    requested?: number
    formula?: string
    canGrant?: boolean
    rejected?: boolean
    ltvThreshold?: number
    waiting?: boolean
    status?: string
    contractStatus?: string
    couponId?: string
    finalBenefit?: number
    decision?: string
    reason?: string
    archiveReason?: string
    received?: string
    action?: string
    insight?: string
    proposal?: {
      productName?: string
      description?: string
      originalPrice?: number
      maxBenefit?: number
      window?: string
      note?: string
    }
    evaluation?: {
      originalBudget?: number
      proposedPrice?: number
      discount?: number
      finalPrice?: number
      verdict?: string
      decision?: string
      reasoning?: string
    }
    isCounterProposal?: boolean
    narrative?: string
    keyInsight?: string
    minted?: string
    discountValue?: number
    minOrderAmount?: number
    productBound?: string
    validWindow?: string
    couponStatus?: string
    [key: string]: unknown
  }
}

// ─── Derive display from a single event ────────────────────────────────────────

type DisplayInfo = {
  side: 'left' | 'right' | 'center'
  icon: string
  color: string
  label: string
  body?: string
  tag?: string
  tagColor?: string
  draftCard?: ContractDraft & { version?: string; isUpgrade?: boolean }
}

function getEventDisplay(ev: NegotiationEvent): DisplayInfo | null {
  const d = ev.data ?? {}
  const step = ev.step

  if (step === 0) return null

  const role = d.role

  // ── asC ──────────────────────────────────────────────────────────
  if (role === 'asC') {
    if (step === 1 && d.intent) {
      return {
        side: 'left', icon: '💬', color: '#20c4cb',
        label: `"${d.intent}"`,
        tag: `${d.userName ?? ''} · LTV ${d.ltv ?? '?'}`,
        tagColor: '#20c4cb',
      }
    }
    if ((d as Record<string,unknown>).type === 'counter' || (d.counter && step === 4)) {
      return {
        side: 'left', icon: '🔄', color: '#fbbf24',
        label: d.counter as string ?? '能不能再多 ¥6？',
        tag: '反询', tagColor: '#fbbf24',
      }
    }
    if (d.decision === 'accept' && step === 4) {
      return {
        side: 'left', icon: '✅', color: '#34d399',
        label: `接受草案 v1（¥${(d.draft as ContractDraft)?.maxBenefit ?? '?'}）`,
      }
    }
    if (d.decision === 'accept' && (step === 7 || step === 9)) {
      return {
        side: 'left', icon: '✅', color: '#34d399',
        label: step === 9 ? `代 Bob 接受升级提案` : `接受草案 v2`,
      }
    }
    if (d.received === 'REJECTED') {
      return {
        side: 'left', icon: '📩', color: '#f87171',
        label: '收到拒绝通知',
        body: d.archiveReason ?? '',
        tag: '协商终止', tagColor: '#ef4444',
      }
    }
    if (d.evaluation) {
      const ev2 = d.evaluation
      return {
        side: 'left', icon: '🧮', color: '#a78bfa',
        label: '评估升级提案',
        body: `¥${ev2.proposedPrice} − ¥${ev2.discount} = 实付 ¥${ev2.finalPrice}\n${ev2.verdict ?? ''}\n${ev2.reasoning ?? ''}`,
        tag: ev2.decision === 'accept' ? '✅ 决策：接受' : '❌ 拒绝',
        tagColor: ev2.decision === 'accept' ? '#34d399' : '#ef4444',
      }
    }
    return null
  }

  // ── asB ──────────────────────────────────────────────────────────
  if (role === 'asB') {
    if (d.evaluating) {
      return {
        side: 'right', icon: '🧠', color: '#a78bfa',
        label: '评估用户画像',
        body: `LTV: ${d.ltv}  供给评分: ${d.supplyScore ?? 85}  时段: ${d.timeSlot ?? '19-22 匹配'}`,
      }
    }
    if (d.draft && d.round === 1 && !d.isCounterProposal) {
      return {
        side: 'right', icon: '📄', color: '#20c4cb',
        label: '发出草案 v1',
        draftCard: { ...d.draft, version: 'v1' },
      }
    }
    if (d.formula !== undefined && step === 5) {
      const rej = d.rejected || d.canGrant === false
      return {
        side: 'right', icon: '📊', color: rej ? '#ef4444' : '#fbbf24',
        label: rej
          ? `⛔ 信用门槛不足（LTV ${d.ltv} < ${d.ltvThreshold}）`
          : '重评估让利空间',
        body: `${d.formula}  →  最高 ¥${d.maxAllowed ?? '?'}（请求 ¥${d.requested ?? '?'}）`,
        tag: rej ? '无法上调' : d.canGrant ? '可以上调' : '上调受限',
        tagColor: rej ? '#ef4444' : d.canGrant ? '#34d399' : '#fbbf24',
      }
    }
    if (d.decision === 'reject' && step === 6) {
      return {
        side: 'right', icon: '❌', color: '#ef4444',
        label: '拒绝原始合约',
        body: d.reason ?? '',
        tag: 'REJECTED', tagColor: '#ef4444',
      }
    }
    if (d.action === 'counter_proposal') {
      const p = d.proposal
      return {
        side: 'right', icon: '🔍', color: '#f59e0b',
        label: '主动寻路：反向提案',
        body: d.insight ?? '',
        tag: '升级方案', tagColor: '#f59e0b',
        draftCard: p ? {
          productName: p.productName,
          originalPrice: p.originalPrice,
          maxBenefit: p.maxBenefit,
          window: p.window,
          note: p.note,
          isUpgrade: true,
          version: '反向提案',
        } : undefined,
      }
    }
    if (d.isCounterProposal && d.draft) {
      return {
        side: 'right', icon: '📤', color: '#f59e0b',
        label: '发出升级草案',
        draftCard: { ...d.draft, version: '升级版', isUpgrade: true },
      }
    }
    if (d.draft && d.round === 2 && !d.isCounterProposal) {
      return {
        side: 'right', icon: '📄', color: '#20c4cb',
        label: '发出草案 v2（已达上限）',
        draftCard: { ...d.draft, version: 'v2' },
      }
    }
    return null
  }

  // ── center ────────────────────────────────────────────────────────
  if (ev.data?.status === 'STRIKE' || ev.title?.includes('STRIKE')) {
    const fb = d.finalBenefit
    return {
      side: 'center', icon: '🤝', color: '#60a5fa',
      label: `合约成交 STRIKE — 最终让利 ¥${fb ?? '?'}`,
      body: d.narrative ?? undefined,
      tag: 'STRIKE ✅', tagColor: '#60a5fa',
    }
  }
  if (d.minted === 'on-demand' || ev.title?.includes('dynamicMint')) {
    return {
      side: 'center', icon: '⚡', color: '#818cf8',
      label: '实时制券 dynamicMint',
      body: [
        d.productBound ? `商品：${d.productBound}` : null,
        d.discountValue != null ? `优惠：¥${d.discountValue}` : null,
        d.minOrderAmount ? `门槛：¥${d.minOrderAmount}` : null,
        d.validWindow ? `有效期：${d.validWindow}` : null,
      ].filter(Boolean).join('  ') || undefined,
      tag: '按需铸造', tagColor: '#818cf8',
    }
  }
  if (d.couponStatus === 'ISSUED' || (d.contractStatus === 'FULFILLED' && ev.type === 'state_change')) {
    return {
      side: 'center', icon: '✅', color: '#34d399',
      label: '合约履约完成 FULFILLED',
      body: d.couponId ? `券ID：${d.couponId as string}` : undefined,
      tag: 'FULFILLED', tagColor: '#34d399',
    }
  }
  if (ev.type === 'complete') {
    return {
      side: 'center', icon: '🎉', color: '#34d399',
      label: ev.description ?? '场景完成',
      body: d.keyInsight ?? undefined,
      tag: '✅', tagColor: '#34d399',
    }
  }

  return null
}

// ─── Draft Card ────────────────────────────────────────────────────────────────

const DraftCard: React.FC<{ draft: ContractDraft & { version?: string; isUpgrade?: boolean } }> = ({ draft }) => {
  const isUpgrade = draft.isUpgrade
  const accent = isUpgrade ? '#f59e0b' : '#20c4cb'
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="rounded-xl border p-3 my-1.5 w-full"
      style={{ borderColor: accent + '55', background: isUpgrade ? '#130e00' : '#0a2028' }}
    >
      {draft.version && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold" style={{ color: accent }}>草案 {draft.version}</span>
          {draft.note && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              {draft.note}
            </span>
          )}
        </div>
      )}
      {draft.productName && (
        <div className="text-xs font-semibold mb-1.5" style={{ color: accent }}>
          🍱 {draft.productName}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {draft.originalPrice && (
          <span className="text-slate-500 text-sm line-through">¥{draft.originalPrice}</span>
        )}
        {draft.maxBenefit != null && (
          <>
            <span className="text-slate-400 text-xs">优惠</span>
            <span className="text-xl font-bold" style={{ color: accent }}>¥{draft.maxBenefit}</span>
          </>
        )}
        {draft.discount != null && !draft.originalPrice && (
          <>
            <span className="text-slate-400 text-xs">折扣</span>
            <span className="text-lg font-bold text-white">{Math.round(draft.discount * 100)}折</span>
          </>
        )}
      </div>
      {draft.window && <div className="text-xs text-slate-500 mt-1">{draft.window}</div>}
      {draft.description && <div className="text-xs text-slate-400 mt-0.5">{draft.description}</div>}
    </motion.div>
  )
}

// ─── Single Event Row ──────────────────────────────────────────────────────────

const EventRow: React.FC<{ ev: NegotiationEvent; idx: number }> = ({ ev, idx }) => {
  const display = getEventDisplay(ev)
  if (!display) return null

  const { side, icon, color, label, body, tag, tagColor, draftCard } = display

  if (side === 'center') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(idx * 0.04, 0.3) }}
        className="flex flex-col items-center my-2 px-1"
      >
        <div
          className="flex items-start gap-2 rounded-xl px-3 py-2.5 border w-full text-xs"
          style={{ background: color + '10', borderColor: color + '40' }}
        >
          <span className="text-sm shrink-0 mt-0.5">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold" style={{ color }}>{label}</div>
            {body && <div className="text-slate-400 mt-0.5 leading-relaxed whitespace-pre-line">{body}</div>}
          </div>
          {tag && (
            <span
              className="shrink-0 text-xs px-2 py-0.5 rounded-full font-bold self-start"
              style={{ background: (tagColor ?? color) + '20', color: tagColor ?? color }}
            >
              {tag}
            </span>
          )}
        </div>
      </motion.div>
    )
  }

  const isLeft = side === 'left'
  return (
    <motion.div
      initial={{ opacity: 0, x: isLeft ? -8 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(idx * 0.04, 0.25) }}
      className="my-1.5"
    >
      <div className={`flex items-start gap-1.5 ${isLeft ? '' : 'flex-row-reverse'}`}>
        <span className="text-sm shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          {draftCard ? (
            <>
              <DraftCard draft={draftCard} />
              <div className="text-xs px-1 mt-0.5" style={{ color: '#94a3b8' }}>{label}</div>
            </>
          ) : (
            <div
              className="rounded-xl px-3 py-2 text-xs border leading-relaxed"
              style={{ background: color + '12', borderColor: color + '35' }}
            >
              <span style={{ color, fontWeight: 600 }}>{label}</span>
              {body && <div className="text-slate-400 mt-0.5 whitespace-pre-line">{body}</div>}
            </div>
          )}
          {tag && !draftCard && (
            <div className={`mt-1 ${isLeft ? '' : 'text-right'}`}>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: (tagColor ?? color) + '18', color: tagColor ?? color }}
              >
                {tag}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Phase Progress Strip ──────────────────────────────────────────────────────

type Phase = 'negotiating' | 'rejected' | 'reproposing' | 'strike' | 'fulfilled'

function derivePhase(events: NegotiationEvent[]): Phase {
  if (events.some(e => e.data?.couponStatus === 'ISSUED' || (e.data?.contractStatus === 'FULFILLED'))) return 'fulfilled'
  if (events.some(e => e.data?.status === 'STRIKE' || e.title?.includes('STRIKE'))) return 'strike'
  if (events.some(e => e.data?.action === 'counter_proposal' || e.data?.isCounterProposal)) return 'reproposing'
  if (events.some(e => e.data?.decision === 'reject')) return 'rejected'
  return 'negotiating'
}

const PHASES: { id: Phase; label: string; icon: string; color: string }[] = [
  { id: 'negotiating', label: '协商中', icon: '💬', color: '#20c4cb' },
  { id: 'rejected', label: '拒绝', icon: '❌', color: '#ef4444' },
  { id: 'reproposing', label: '寻路', icon: '🔍', color: '#f59e0b' },
  { id: 'strike', label: '成交', icon: '🤝', color: '#60a5fa' },
  { id: 'fulfilled', label: '履约', icon: '✅', color: '#34d399' },
]

const PhaseStrip: React.FC<{ phase: Phase }> = ({ phase }) => {
  const idx = PHASES.findIndex(p => p.id === phase)
  return (
    <div className="shrink-0 px-4 py-2.5 border-t border-border flex items-center gap-1" style={{ background: '#0f1117' }}>
      {PHASES.map((p, i) => {
        const done = i < idx
        const active = i === idx
        const color = done || active ? p.color : '#374151'
        return (
          <React.Fragment key={p.id}>
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <motion.div
                animate={{ scale: active ? [1, 1.15, 1] : 1 }}
                transition={{ duration: 0.6, repeat: active ? Infinity : 0, repeatDelay: 2 }}
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                style={{
                  background: color + '20',
                  border: `2px solid ${color + (active ? 'cc' : '40')}`,
                  boxShadow: active ? `0 0 8px ${color}60` : 'none',
                }}
              >
                {p.icon}
              </motion.div>
              <span className="text-xs font-medium" style={{ color }}>{p.label}</span>
            </div>
            {i < PHASES.length - 1 && (
              <div className="flex-1 h-0.5 rounded mb-4"
                style={{ background: done ? `linear-gradient(90deg, ${p.color}, ${PHASES[i + 1].color})` : '#1f2937' }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── User Action Buttons ───────────────────────────────────────────────────────

const UserAction: React.FC<{ contractId: string; onResponded: () => void }> = ({ contractId, onResponded }) => {
  const [showCounter, setShowCounter] = useState(false)
  const [counterText, setCounterText] = useState('能不能再多 ¥6？')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (action: 'accept' | 'counter' | 'reject') => {
    setSubmitting(true)
    try {
      await apiFetch('/scene/4/respond', {
        method: 'POST',
        body: JSON.stringify({ contractId, action, counterText: action === 'counter' ? counterText : undefined }),
      })
      onResponded()
    } finally { setSubmitting(false) }
  }

  if (showCounter) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border p-3 my-2" style={{ borderColor: '#fbbf2460', background: '#120e00' }}
      >
        <div className="text-xs text-yellow-400 mb-2">🔄 反询内容：</div>
        <input value={counterText} onChange={e => setCounterText(e.target.value)}
          className="w-full text-xs px-3 py-2 rounded-lg border border-yellow-500/40 bg-[#0f1117] text-slate-200 focus:outline-none focus:border-yellow-400 mb-2"
        />
        <div className="flex gap-2">
          <button onClick={() => submit('counter')} disabled={submitting}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-black bg-yellow-400 hover:bg-yellow-300 transition-colors">
            发出反询
          </button>
          <button onClick={() => setShowCounter(false)}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-border">取消</button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 my-2">
      <button onClick={() => submit('accept')} disabled={submitting}
        className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all"
        style={{ borderColor: '#10b98160', color: '#34d399', background: '#10b98115' }}>
        ✅ 接受
      </button>
      <button onClick={() => setShowCounter(true)}
        className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all"
        style={{ borderColor: '#fbbf2460', color: '#fbbf24', background: '#fbbf2415' }}>
        🔄 反询
      </button>
      <button onClick={() => submit('reject')}
        className="px-3 py-2 rounded-lg text-xs border transition-all"
        style={{ borderColor: '#ef444460', color: '#f87171', background: '#ef444415' }}>
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
  const [responded, setResponded] = useState(false)

  const phase = derivePhase(events)
  const waitingEv = events.find(e => e.data?.waiting === true)
  const waitingForUser = !!(waitingEv && !responded && mode === 'manual')
  const contractId = waitingEv?.data?.contractId as string | undefined

  // Separate events by side
  const leftEvs: (NegotiationEvent & { origIdx: number })[] = []
  const rightEvs: (NegotiationEvent & { origIdx: number })[] = []
  const centerEvs: (NegotiationEvent & { origIdx: number })[] = []

  events.forEach((ev, i) => {
    if (ev.step === 0) return
    const d = getEventDisplay(ev)
    if (!d) return
    const item = { ...ev, origIdx: i }
    if (d.side === 'left') leftEvs.push(item)
    else if (d.side === 'right') rightEvs.push(item)
    else centerEvs.push(item)
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Two-column area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Left — asC */}
        <div className="flex-1 flex flex-col overflow-y-auto px-3 py-3 border-r border-border" style={{ background: '#0f1117' }}>
          {/* Column header */}
          <div className="flex items-center gap-2 mb-3 shrink-0 pb-2 border-b border-border/50">
            <span className="text-base">👤</span>
            <div>
              <span className="font-semibold text-slate-200 text-sm">asC</span>
              <span className="text-xs text-slate-500 ml-1.5">
                {events.find(e => e.data?.userName)?.data?.userName ?? '用户'}的数字分身
              </span>
            </div>
            <span className="ml-auto text-xs px-1.5 py-0.5 rounded border text-cyan-400"
              style={{ borderColor: '#20c4cb40', background: '#20c4cb10' }}>
              消费者Agent
            </span>
          </div>

          <AnimatePresence mode="sync">
            {leftEvs.map(ev => (
              <EventRow key={`l${ev.origIdx}`} ev={ev} idx={ev.origIdx} />
            ))}

            {waitingForUser && contractId && (
              <UserAction key="ua" contractId={contractId} onResponded={() => setResponded(true)} />
            )}
          </AnimatePresence>
        </div>

        {/* Right — asB */}
        <div className="flex-1 flex flex-col overflow-y-auto px-3 py-3" style={{ background: '#0c1820' }}>
          {/* Column header */}
          <div className="flex items-center gap-2 mb-3 shrink-0 pb-2 border-b border-border/50">
            <span className="text-base">🤖</span>
            <div>
              <span className="font-semibold text-slate-200 text-sm">asB</span>
              <span className="text-xs text-slate-500 ml-1.5">美团优惠券系统</span>
            </div>
            <span className="ml-auto text-xs px-1.5 py-0.5 rounded border text-purple-400"
              style={{ borderColor: '#a78bfa40', background: '#a78bfa10' }}>
              商家Agent
            </span>
          </div>

          <AnimatePresence mode="sync">
            {rightEvs.map(ev => (
              <EventRow key={`r${ev.origIdx}`} ev={ev} idx={ev.origIdx} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Center events — STRIKE / mint / fulfilled / complete: shown below columns */}
      {centerEvs.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-border/50" style={{ background: '#0d111a' }}>
          <AnimatePresence mode="sync">
            {centerEvs.map(ev => (
              <EventRow key={`c${ev.origIdx}`} ev={ev} idx={ev.origIdx} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Phase progress */}
      <PhaseStrip phase={phase} />
    </div>
  )
}
