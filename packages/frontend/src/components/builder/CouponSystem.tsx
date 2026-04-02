import React, { useState, useEffect, useRef } from 'react'
import { usePolling } from '../../hooks/useApi'
import type { CouponStats } from '../../types'

interface RawCouponStats {
  totalTemplates: number
  totalCoupons: number
  totalIssued: number
  totalRedeemed: number
  totalExpired: number
  pendingContracts: number
  fulfilledContracts: number
  auditEntries: number
}

interface RawCouponStatsResponse {
  ok: boolean
  data: RawCouponStats
}

// ——— 能力分组数据 ———
const CAPABILITY_GROUPS = [
  {
    icon: '🏭',
    name: '制券',
    color: '#20c4cb',
    items: [
      { name: 'createCouponTemplate', desc: '创建新的优惠券模板，定义面值、有效期、适用范围' },
      { name: 'batchMint', desc: '批量铸造优惠券，基于已有模板生成指定数量的实体券' },
      { name: 'dynamicMint', desc: '合约经济：根据用户 LTV 实时制券，让利上限动态计算', badge: '⭐合约经济' },
    ],
  },
  {
    icon: '📤',
    name: '发券',
    color: '#818cf8',
    items: [
      { name: 'issueToUser', desc: '向单个用户发放优惠券，自动校验黑名单和领券上限' },
      { name: 'batchIssue', desc: '批量发券，支持按用户群体或活动维度批量分发' },
      { name: 'issueByContract', desc: '合约触发发券，Agent 谈判后自动执行发放' },
    ],
  },
  {
    icon: '✅',
    name: '核销',
    color: '#4ade80',
    items: [
      { name: 'verify', desc: '校验优惠券有效性，包括状态、有效期、使用条件' },
      { name: 'redeem', desc: '核销优惠券，完成消费抵扣并更新券状态为 REDEEMED' },
      { name: 'checkEligibility', desc: '检查用户是否满足核销条件，返回资格判断结果' },
    ],
  },
  {
    icon: '🔍',
    name: '查询',
    color: '#fb923c',
    items: [
      { name: 'getCoupon', desc: '按券 ID 查询单张优惠券详情及当前状态' },
      { name: 'listByUser', desc: '查询指定用户持有的全部优惠券列表' },
      { name: 'listByActivity', desc: '按活动维度查询该活动下的所有发券记录' },
    ],
  },
  {
    icon: '🛡️',
    name: '管控',
    color: '#f472b6',
    items: [
      { name: 'pause', desc: '暂停优惠券或模板，暂停期间不可核销' },
      { name: 'resume', desc: '恢复已暂停的优惠券，重新允许核销' },
      { name: 'expire', desc: '强制使优惠券过期，适用于活动终止等场景' },
      { name: 'setLimit', desc: '设置发券频次、数量限制，防止超发' },
    ],
  },
  {
    icon: '💰',
    name: '清算',
    color: '#facc15',
    items: [
      { name: 'fulfill', desc: '完成合约清算，将锁定资金确认转移给商家' },
      { name: 'refund', desc: '退款退券处理，释放预授权锁定并恢复券状态' },
    ],
  },
]

// ——— 业务规则 ———
const BUSINESS_RULES = [
  { id: 1, label: '每用户每天领券上限', value: '3 张' },
  { id: 2, label: '单张面值上限', value: '¥100' },
  { id: 3, label: '发券前检查', value: '用户黑名单 / 活动有效期 / 库存余量' },
  { id: 4, label: '动态制券触发条件', value: 'LTV ≥ 80' },
  { id: 5, label: '动态制券让利上限', value: 'min(LTV × 0.4, ¥50)' },
]

// ——— 数字动画 hook ———
function useAnimatedNumber(target: number, duration = 600) {
  const [display, setDisplay] = useState(target)
  const prev = useRef(target)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (prev.current === target) return
    const start = prev.current
    const diff = target - start
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + diff * eased))
      if (progress < 1) {
        raf.current = requestAnimationFrame(animate)
      } else {
        prev.current = target
      }
    }

    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(animate)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])

  return display
}

// ——— 统计卡片 ———
const StatCard: React.FC<{ label: string; value: number | string; prefix?: string; suffix?: string }> = ({
  label, value, prefix = '', suffix = '',
}) => {
  const numValue = typeof value === 'number' ? value : 0
  const animated = useAnimatedNumber(numValue)
  const display = typeof value === 'number' ? animated : value

  return (
    <div className="flex flex-col items-center justify-center bg-bg rounded-xl border border-border p-4 min-w-[110px]">
      <span className="text-3xl font-bold font-mono text-text-primary tabular-nums">
        {prefix}{display}{suffix}
      </span>
      <span className="text-xs text-text-secondary mt-1 text-center">{label}</span>
    </div>
  )
}

// ——— 主组件 ———
const CouponSystem: React.FC = () => {
  const [rulesOpen, setRulesOpen] = useState(true)
  const fallbackRaw: RawCouponStatsResponse = { ok: false, data: { totalTemplates: 12, totalCoupons: 0, totalIssued: 0, totalRedeemed: 0, totalExpired: 0, pendingContracts: 0, fulfilledContracts: 0, auditEntries: 0 } }
  const { data: rawStats, error } = usePolling<RawCouponStatsResponse>('/coupon/stats', 5000, fallbackRaw)
  const stats: CouponStats = {
    templates: rawStats?.data?.totalTemplates ?? 12,
    issued: rawStats?.data?.totalIssued ?? 0,
    redeemed: rawStats?.data?.totalRedeemed ?? 0,
    activeContracts: rawStats?.data?.pendingContracts ?? 0,
    lockedAmount: 0,
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto h-full">
      {/* 标题 */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎟️</span>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">优惠券系统</h2>
          <p className="text-xs text-text-secondary">Coupon System — 能力列表 / 实时数据 / 业务规则</p>
        </div>
        {error && (
          <span className="ml-auto text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-2 py-1 rounded">
            ⚠️ 后端未连接，使用默认数据
          </span>
        )}
      </div>

      {/* ① 实时数据看板 */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="text-xs text-text-secondary font-mono mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
          实时数据看板 · 每 5 秒轮询 GET /api/coupon/stats
        </div>
        <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
          <StatCard label="券模板数" value={stats.templates} />
          <StatCard label="已发行" value={stats.issued} />
          <StatCard label="已核销" value={stats.redeemed} />
          <StatCard label="活跃合约" value={stats.activeContracts} />
          <StatCard label="预授权锁定" value={stats.lockedAmount} prefix="¥" />
        </div>
      </div>

      {/* ② 能力列表 */}
      <div>
        <div className="text-xs text-text-secondary font-mono mb-3">能力列表 · 6 个分组 · 18 个接口</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {CAPABILITY_GROUPS.map(group => (
            <div
              key={group.name}
              className="bg-surface rounded-xl border border-border overflow-hidden"
            >
              {/* Group header */}
              <div
                className="flex items-center gap-2 px-4 py-3 border-b border-border"
                style={{ borderLeftWidth: 3, borderLeftColor: group.color }}
              >
                <span className="text-lg">{group.icon}</span>
                <span className="font-semibold text-sm" style={{ color: group.color }}>
                  {group.name}
                </span>
                <span className="ml-auto text-xs text-text-secondary">{group.items.length} 个接口</span>
              </div>
              {/* Items */}
              <div className="divide-y divide-border">
                {group.items.map(item => (
                  <div key={item.name} className="px-4 py-2.5 hover:bg-bg/50 transition-colors">
                    <div className="flex items-center gap-2 mb-0.5">
                      <code className="text-xs font-mono text-accent">{item.name}</code>
                      {item.badge && (
                        <span className="text-[10px] bg-accent/15 text-accent border border-accent/30 rounded px-1 py-0.5">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ③ 业务规则面板（可折叠） */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-bg/30 transition-colors"
          onClick={() => setRulesOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <span className="font-semibold text-sm text-text-primary">业务规则面板</span>
            <span className="text-xs text-text-secondary">{BUSINESS_RULES.length} 条规则</span>
          </div>
          <span className="text-text-secondary text-lg transition-transform" style={{
            transform: rulesOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ⌄
          </span>
        </button>
        {rulesOpen && (
          <div className="border-t border-border divide-y divide-border">
            {BUSINESS_RULES.map(rule => (
              <div key={rule.id} className="flex items-start gap-3 px-5 py-3">
                <span className="text-accent font-mono text-xs mt-0.5 w-4 shrink-0">
                  {String(rule.id).padStart(2, '0')}
                </span>
                <span className="text-sm text-text-secondary flex-1">{rule.label}</span>
                <span className="text-sm text-text-primary font-medium font-mono text-right">{rule.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CouponSystem
