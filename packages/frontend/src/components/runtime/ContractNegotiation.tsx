/**
 * ContractNegotiation.tsx — Scene 4 合约协商 UI
 * 布局规则：
 *   - asC 事件 → 左列
 *   - asB 事件 → 右列
 *   - STRIKE / mint / FULFILLED / complete → 底部中央区（绝对不出现在左右列）
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SceneEvent } from '../../hooks/useSSE'
import { apiFetch } from '../../hooks/useApi'

interface DraftP {
  discount?: number; maxBenefit?: number; window?: string; note?: string
  productName?: string; originalPrice?: number; description?: string
}

interface EvData {
  role?: 'asC' | 'asB'
  intent?: string; contractId?: string; userName?: string; tier?: string
  ltv?: number; timeSlot?: string; supplyScore?: number; evaluating?: boolean
  draft?: DraftP; round?: number; counter?: string
  maxAllowed?: number; requested?: number; formula?: string
  canGrant?: boolean; rejected?: boolean; ltvThreshold?: number
  waiting?: boolean; status?: string; contractStatus?: string
  couponStatus?: string; couponId?: string; finalBenefit?: number
  decision?: string; reason?: string; archiveReason?: string; received?: string
  action?: string; insight?: string; isCounterProposal?: boolean
  narrative?: string; keyInsight?: string; minted?: string
  discountValue?: number; minOrderAmount?: number; productBound?: string; validWindow?: string
  proposal?: { productName?: string; description?: string; originalPrice?: number; maxBenefit?: number; window?: string; note?: string }
  evaluation?: { originalBudget?: number; proposedPrice?: number; discount?: number; finalPrice?: number; verdict?: string; decision?: string; reasoning?: string }
  [k: string]: unknown
}

interface NegEv extends SceneEvent { data?: EvData }

type Side = 'left' | 'right' | 'center' | 'skip'

function side(ev: NegEv): Side {
  if (ev.step === 0) return 'skip'
  if (ev.type === 'audit') return 'skip'
  const d = ev.data ?? {}
  if (d.role === 'asC') return 'left'
  if (d.role === 'asB') return 'right'
  if (d.status === 'STRIKE') return 'center'
  if (d.minted === 'on-demand') return 'center'
  if (d.couponStatus === 'ISSUED') return 'center'
  if (ev.type === 'state_change' && d.contractStatus === 'FULFILLED') return 'center'
  if (ev.type === 'complete') return 'center'
  return 'skip'
}

interface Desc {
  icon: string; color: string; label: string; body?: string
  tag?: string; tagColor?: string
  draft?: DraftP & { version: string; isUpgrade?: boolean }
}

function describe(ev: NegEv): Desc | null {
  const d = ev.data ?? {}
  const s = side(ev)
  if (s === 'skip') return null

  if (s === 'left') {
    if (d.intent && !d.evaluation && !d.decision && !d.counter && d.received !== 'REJECTED')
      return { icon: '💬', color: '#20c4cb', label: `"${d.intent}"`, tag: `${d.userName ?? ''} · LTV ${d.ltv ?? '?'}`, tagColor: '#20c4cb' }
    if (d.counter || (d as any).type === 'counter')
      return { icon: '🔄', color: '#fbbf24', label: String(d.counter ?? '能不能再多 ¥6？'), tag: '反询', tagColor: '#fbbf24' }
    if (d.decision === 'accept' && !d.evaluation) {
      const b = (d.draft as DraftP)?.maxBenefit ?? d.finalBenefit
      return { icon: '✅', color: '#34d399', label: b ? `接受草案，让利 ¥${b}` : '接受草案' }
    }
    if (d.evaluation) {
      const e = d.evaluation, ok = e.decision === 'accept'
      return { icon: '🧮', color: '#a78bfa', label: '代用户评估升级提案',
        body: `¥${e.proposedPrice} − ¥${e.discount} = 实付 ¥${e.finalPrice}\n${e.verdict ?? ''}\n${e.reasoning ?? ''}`,
        tag: ok ? '✅ 决策：接受' : '❌ 决策：拒绝', tagColor: ok ? '#34d399' : '#ef4444' }
    }
    if (d.received === 'REJECTED')
      return { icon: '📩', color: '#f87171', label: '收到拒绝通知', body: d.archiveReason ?? '', tag: '协商终止', tagColor: '#ef4444' }
    return null
  }

  if (s === 'right') {
    if (d.evaluating)
      return { icon: '🧠', color: '#a78bfa', label: '评估用户画像',
        body: `LTV: ${d.ltv}  供给评分: ${d.supplyScore ?? 85}  时段: ${d.timeSlot ?? '19-22 匹配'}` }
    if (d.draft && !d.isCounterProposal && (d.round === 1 || d.round === 2)) {
      const v = d.round === 1 ? 'v1' : 'v2'
      return { icon: '📄', color: '#20c4cb', label: `发出草案 ${v}`, draft: { ...d.draft, version: v } }
    }
    if (d.formula !== undefined) {
      const rej = d.rejected || d.canGrant === false
      return { icon: '📊', color: rej ? '#ef4444' : '#fbbf24',
        label: rej ? `⛔ 信用门槛不足（LTV ${d.ltv} < ${d.ltvThreshold ?? 20}）` : '重评估让利空间',
        body: `${d.formula}  →  最高 ¥${d.maxAllowed ?? '?'}（请求 ¥${d.requested ?? '?'}）`,
        tag: rej ? '无法上调' : d.canGrant ? '可以上调' : '上调受限',
        tagColor: rej ? '#ef4444' : '#fbbf24' }
    }
    if (d.decision === 'reject')
      return { icon: '❌', color: '#ef4444', label: '拒绝原始合约', body: d.reason ?? '', tag: 'REJECTED', tagColor: '#ef4444' }
    if (d.action === 'counter_proposal') {
      const p = d.proposal
      return { icon: '🔍', color: '#f59e0b', label: '主动寻路：反向提案', body: d.insight ?? '',
        tag: '升级方案', tagColor: '#f59e0b',
        draft: p ? { productName: p.productName, originalPrice: p.originalPrice, maxBenefit: p.maxBenefit,
          window: p.window, note: p.note, version: '反向提案', isUpgrade: true } : undefined }
    }
    if (d.isCounterProposal && d.draft)
      return { icon: '📤', color: '#f59e0b', label: '发出升级草案', draft: { ...d.draft, version: '升级版', isUpgrade: true } }
    return null
  }

  // center
  if (d.status === 'STRIKE')
    return { icon: '🤝', color: '#60a5fa', label: `合约成交 STRIKE — 最终让利 ¥${d.finalBenefit ?? '?'}`,
      body: d.narrative ?? undefined, tag: 'STRIKE ✅', tagColor: '#60a5fa' }
  if (d.minted === 'on-demand') {
    const parts = [
      d.productBound ? `商品：${d.productBound}` : null,
      d.discountValue != null ? `优惠：¥${d.discountValue}` : null,
      d.minOrderAmount ? `门槛：¥${d.minOrderAmount}` : null,
      d.validWindow ? `有效期：${d.validWindow}` : null,
    ].filter(Boolean).join('  ')
    return { icon: '⚡', color: '#818cf8', label: '实时制券 dynamicMint', body: parts || undefined, tag: '按需铸造', tagColor: '#818cf8' }
  }
  if (d.couponStatus === 'ISSUED' || d.contractStatus === 'FULFILLED')
    return { icon: '✅', color: '#34d399', label: '合约履约完成 FULFILLED',
      body: d.couponId ? `券ID：${d.couponId}` : undefined, tag: 'FULFILLED', tagColor: '#34d399' }
  if (ev.type === 'complete')
    return { icon: '🎉', color: '#34d399', label: ev.description ?? '场景完成',
      body: d.keyInsight ?? undefined, tag: '✅', tagColor: '#34d399' }
  return null
}

// ── Draft Card ────────────────────────────────────────────────────────────────
const DraftCard: React.FC<{ d: DraftP & { version: string; isUpgrade?: boolean } }> = ({ d }) => {
  const up = d.isUpgrade, accent = up ? '#f59e0b' : '#20c4cb'
  return (
    <motion.div initial={{ opacity: 0, scale: 0.88, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className="rounded-xl border p-3 my-1.5 w-full"
      style={{ borderColor: accent + '55', background: up ? '#130e00' : '#071820' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold" style={{ color: accent }}>草案 {d.version}</span>
        {d.note && <span className="text-xs px-1.5 py-0.5 rounded border bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{d.note}</span>}
      </div>
      {d.productName && <div className="text-xs font-semibold mb-1.5" style={{ color: accent }}>🍱 {d.productName}</div>}
      <div className="flex items-center gap-2 flex-wrap">
        {d.originalPrice != null && <span className="text-slate-500 text-sm line-through">¥{d.originalPrice}</span>}
        {d.maxBenefit != null && <span className="text-xl font-bold" style={{ color: accent }}>优惠 ¥{d.maxBenefit}</span>}
        {d.discount != null && d.originalPrice == null && <span className="text-lg font-bold text-white">{Math.round(d.discount * 100)}折</span>}
      </div>
      {d.window && <div className="text-xs text-slate-500 mt-1">{d.window}</div>}
      {d.description && <div className="text-xs text-slate-400 mt-0.5">{d.description}</div>}
    </motion.div>
  )
}

// ── Event Row ─────────────────────────────────────────────────────────────────
const EvRow: React.FC<{ ev: NegEv; idx: number; isCenter?: boolean }> = ({ ev, idx, isCenter }) => {
  const desc = describe(ev)
  if (!desc) return null
  const { icon, color, label, body, tag, tagColor, draft } = desc
  const evSide = side(ev)

  if (isCenter || evSide === 'center') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(idx * 0.03, 0.2) }}
        className="flex items-start gap-2 rounded-xl px-3 py-2.5 border my-1 text-xs"
        style={{ background: color + '10', borderColor: color + '40' }}>
        <span className="text-sm shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold" style={{ color }}>{label}</div>
          {body && <div className="text-slate-400 mt-0.5 leading-relaxed whitespace-pre-line">{body}</div>}
        </div>
        {tag && (
          <span className="shrink-0 self-start text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: (tagColor ?? color) + '20', color: tagColor ?? color }}>{tag}</span>
        )}
      </motion.div>
    )
  }

  const isLeft = evSide === 'left'
  return (
    <motion.div initial={{ opacity: 0, x: isLeft ? -8 : 8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(idx * 0.03, 0.2) }}
      className="my-1.5">
      <div className={`flex items-start gap-1.5 ${isLeft ? '' : 'flex-row-reverse'}`}>
        <span className="text-sm shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          {draft ? (
            <>
              <DraftCard d={draft} />
              <div className="text-xs px-1 mt-0.5 text-slate-500">{label}</div>
            </>
          ) : (
            <div className="rounded-xl px-3 py-2 text-xs border leading-relaxed"
              style={{ background: color + '12', borderColor: color + '35' }}>
              <div className="font-semibold" style={{ color }}>{label}</div>
              {body && <div className="text-slate-400 mt-0.5 whitespace-pre-line">{body}</div>}
            </div>
          )}
          {tag && !draft && (
            <div className={`mt-1 ${isLeft ? '' : 'text-right'}`}>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: (tagColor ?? color) + '18', color: tagColor ?? color }}>{tag}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Phase Strip ───────────────────────────────────────────────────────────────
type Phase = 'negotiating' | 'rejected' | 'reproposing' | 'strike' | 'fulfilled'

function derivePhase(evs: NegEv[]): Phase {
  if (evs.some(e => e.type === 'complete' || e.data?.couponStatus === 'ISSUED' || (e.type === 'state_change' && e.data?.contractStatus === 'FULFILLED'))) return 'fulfilled'
  if (evs.some(e => e.data?.status === 'STRIKE')) return 'strike'
  if (evs.some(e => e.data?.action === 'counter_proposal' || e.data?.isCounterProposal)) return 'reproposing'
  if (evs.some(e => e.data?.decision === 'reject')) return 'rejected'
  return 'negotiating'
}

const PHASES: { id: Phase; label: string; icon: string; color: string }[] = [
  { id: 'negotiating', label: '协商中', icon: '💬', color: '#20c4cb' },
  { id: 'rejected',    label: '拒绝',   icon: '❌', color: '#ef4444' },
  { id: 'reproposing', label: '寻路',   icon: '🔍', color: '#f59e0b' },
  { id: 'strike',      label: '成交',   icon: '🤝', color: '#60a5fa' },
  { id: 'fulfilled',   label: '履约',   icon: '✅', color: '#34d399' },
]

const PhaseStrip: React.FC<{ phase: Phase }> = ({ phase }) => {
  const idx = PHASES.findIndex(p => p.id === phase)
  return (
    <div className="shrink-0 px-4 py-2.5 border-t border-border flex items-center gap-1" style={{ background: '#0a0d14' }}>
      {PHASES.map((p, i) => {
        const done = i < idx, active = i === idx
        const color = done || active ? p.color : '#374151'
        return (
          <React.Fragment key={p.id}>
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <motion.div animate={{ scale: active ? [1, 1.2, 1] : 1 }}
                transition={{ duration: 0.6, repeat: active ? Infinity : 0, repeatDelay: 2 }}
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                style={{ background: color + '20', border: `2px solid ${color + (active ? 'cc' : '40')}`,
                  boxShadow: active ? `0 0 8px ${color}55` : 'none' }}>
                {p.icon}
              </motion.div>
              <span className="text-[10px] font-medium" style={{ color }}>{p.label}</span>
            </div>
            {i < PHASES.length - 1 && (
              <div className="flex-1 h-0.5 rounded mb-4 transition-all duration-700"
                style={{ background: done ? p.color : '#1f2937' }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── Manual User Action ────────────────────────────────────────────────────────
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
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border p-3 my-2" style={{ borderColor: '#fbbf2460', background: '#120e00' }}>
        <div className="text-xs text-yellow-400 mb-2">🔄 反询内容：</div>
        <input value={counterText} onChange={e => setCounterText(e.target.value)}
          className="w-full text-xs px-3 py-2 rounded-lg border border-yellow-500/40 bg-[#0f1117] text-slate-200 focus:outline-none focus:border-yellow-400 mb-2" />
        <div className="flex gap-2">
          <button onClick={() => submit('counter')} disabled={submitting}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-black bg-yellow-400 hover:bg-yellow-300 transition-colors">
            发出反询
          </button>
          <button onClick={() => setShowCounter(false)} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-border">取消</button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 my-2">
      <button onClick={() => submit('accept')} disabled={submitting}
        className="flex-1 py-2 rounded-lg text-xs font-semibold border"
        style={{ borderColor: '#10b98160', color: '#34d399', background: '#10b98115' }}>✅ 接受</button>
      <button onClick={() => setShowCounter(true)}
        className="flex-1 py-2 rounded-lg text-xs font-semibold border"
        style={{ borderColor: '#fbbf2460', color: '#fbbf24', background: '#fbbf2415' }}>🔄 反询</button>
      <button onClick={() => submit('reject')}
        className="px-3 py-2 rounded-lg text-xs border"
        style={{ borderColor: '#ef444460', color: '#f87171', background: '#ef444415' }}>拒绝</button>
    </motion.div>
  )
}

// ── Main ContractNegotiation ──────────────────────────────────────────────────
export const ContractNegotiation: React.FC<{ events: NegEv[]; mode: 'auto' | 'manual' }> = ({ events, mode }) => {
  const [responded, setResponded] = useState(false)
  const phase = derivePhase(events)

  const waitingEv = events.find(e => e.data?.waiting === true)
  const waitingForUser = !!(waitingEv && !responded && mode === 'manual')
  const contractId = waitingEv?.data?.contractId as string | undefined

  // Strictly partition — center events NEVER go into left/right arrays
  const leftEvs: (NegEv & { oi: number })[] = []
  const rightEvs: (NegEv & { oi: number })[] = []
  const centerEvs: (NegEv & { oi: number })[] = []

  events.forEach((ev, i) => {
    const s = side(ev)
    if (s === 'skip') return
    const item = { ...ev, oi: i }
    if (s === 'left') leftEvs.push(item)
    else if (s === 'right') rightEvs.push(item)
    else centerEvs.push(item)
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Two-column area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Left — asC */}
        <div className="w-1/2 flex flex-col overflow-y-auto px-3 py-3 border-r border-border" style={{ background: '#0f1117' }}>
          <div className="flex items-center gap-2 mb-3 shrink-0 pb-2 border-b border-border/50">
            <span className="text-base">👤</span>
            <div>
              <span className="font-semibold text-slate-200 text-sm">asC</span>
              <span className="text-xs text-slate-500 ml-1.5">
                {events.find(e => e.data?.userName)?.data?.userName ?? '用户'}的数字分身
              </span>
            </div>
            <span className="ml-auto text-xs px-1.5 py-0.5 rounded border text-cyan-400 shrink-0"
              style={{ borderColor: '#20c4cb40', background: '#20c4cb10' }}>消费者Agent</span>
          </div>
          <AnimatePresence mode="sync">
            {leftEvs.map(ev => <EvRow key={`l${ev.oi}`} ev={ev} idx={ev.oi} />)}
            {waitingForUser && contractId && (
              <UserAction key="ua" contractId={contractId} onResponded={() => setResponded(true)} />
            )}
          </AnimatePresence>
        </div>

        {/* Right — asB */}
        <div className="w-1/2 flex flex-col overflow-y-auto px-3 py-3" style={{ background: '#0c1820' }}>
          <div className="flex items-center gap-2 mb-3 shrink-0 pb-2 border-b border-border/50">
            <span className="text-base">🤖</span>
            <div>
              <span className="font-semibold text-slate-200 text-sm">asB</span>
              <span className="text-xs text-slate-500 ml-1.5">美团优惠券系统</span>
            </div>
            <span className="ml-auto text-xs px-1.5 py-0.5 rounded border text-purple-400 shrink-0"
              style={{ borderColor: '#a78bfa40', background: '#a78bfa10' }}>商家Agent</span>
          </div>
          <AnimatePresence mode="sync">
            {rightEvs.map(ev => <EvRow key={`r${ev.oi}`} ev={ev} idx={ev.oi} />)}
          </AnimatePresence>
        </div>
      </div>

      {/* Center events — STRIKE / mint / FULFILLED / complete — unified panel */}
      {centerEvs.length > 0 && (
        <div className="shrink-0 px-4 py-3" style={{ background: '#0a0d14' }}>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#60a5fa30', background: '#060c1a' }}>
            <div className="px-3 py-1.5 border-b flex items-center gap-2" style={{ borderColor: '#60a5fa20', background: '#0d1830' }}>
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#60a5fa99' }}>合约结算</span>
            </div>
            <div className="px-3 py-2 space-y-1">
              <AnimatePresence mode="sync">
                {centerEvs.map(ev => {
                  const desc = describe(ev)
                  if (!desc) return null
                  const { icon, color, label, tag, tagColor } = desc
                  return (
                    <motion.div key={`c${ev.oi}`}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(ev.oi * 0.03, 0.2) }}
                      className="flex items-center gap-2 py-1.5 text-xs">
                      <span className="shrink-0 text-sm">{icon}</span>
                      <span className="flex-1 font-medium" style={{ color }}>{label}</span>
                      {tag && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: (tagColor ?? color) + '20', color: tagColor ?? color }}>
                          {tag}
                        </span>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* Phase progress */}
      <PhaseStrip phase={phase} />
    </div>
  )
}
