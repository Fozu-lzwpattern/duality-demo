import React, { useState } from 'react'
import { useFetch, apiFetch } from '../../hooks/useApi'
import type { UserProfile } from '../../types'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

// ——— 本地 fallback 数据 ———
const FALLBACK_USERS: UserProfile[] = [
  {
    id: 'u001',
    emoji: '🦁',
    name: '张大勇',
    tier: 'Whale',
    orders: 312,
    totalSpend: 58420,
    ltv: 96,
    tags: [
      { label: '外卖', weight: 40 },
      { label: '医药', weight: 25 },
      { label: '酒店', weight: 20 },
      { label: '闪购', weight: 15 },
    ],
    preference: ['夜宵', '健康饮食'],
    activeTime: '晚间 20:00-23:00',
    location: '北京朝阳',
  },
  {
    id: 'u002',
    emoji: '🐰',
    name: '林晓琳',
    tier: 'VIP',
    orders: 178,
    totalSpend: 22350,
    ltv: 82,
    tags: [
      { label: '外卖', weight: 55 },
      { label: '生鲜', weight: 30 },
      { label: '美妆', weight: 15 },
    ],
    preference: ['轻食', '有机'],
    activeTime: '午间 12:00-13:00',
    location: '上海浦东',
  },
  {
    id: 'u003',
    emoji: '🐼',
    name: '王建国',
    tier: 'Regular',
    orders: 64,
    totalSpend: 5280,
    ltv: 45,
    tags: [
      { label: '外卖', weight: 60 },
      { label: '酒水', weight: 25 },
      { label: '零食', weight: 15 },
    ],
    preference: ['快餐', '奶茶'],
    activeTime: '全天随机',
    location: '深圳南山',
  },
  {
    id: 'u004',
    emoji: '🦊',
    name: '陈思远',
    tier: 'VIP',
    orders: 221,
    totalSpend: 31600,
    ltv: 88,
    tags: [
      { label: '酒店', weight: 45 },
      { label: '机票', weight: 30 },
      { label: '外卖', weight: 25 },
    ],
    preference: ['商务出行', '精品酒店'],
    activeTime: '工作日早晚',
    location: '广州天河',
  },
  {
    id: 'u005',
    emoji: '🐱',
    name: '李美华',
    tier: 'New',
    orders: 8,
    totalSpend: 420,
    ltv: 12,
    tags: [
      { label: '外卖', weight: 70 },
      { label: '生鲜', weight: 30 },
    ],
    preference: ['家常菜', '水果'],
    activeTime: '周末午间',
    location: '成都锦江',
  },
]

// ——— 业务标签进度条 ———
const TagBar: React.FC<{ label: string; weight: number; maxWeight: number }> = ({
  label, weight, maxWeight,
}) => {
  const pct = Math.round((weight / maxWeight) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-secondary w-8 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-text-secondary font-mono w-6 text-right">{weight}</span>
    </div>
  )
}

// ——— 用户卡片 ———
const UserCard: React.FC<{
  user: UserProfile
  isCurrent: boolean
  onSetCurrent: (id: string) => void
  setting: boolean
}> = ({ user, isCurrent, onSetCurrent, setting }) => {
  const maxWeight = Math.max(...user.tags.map(t => t.weight))

  return (
    <Card highlighted={isCurrent} className={`transition-all duration-300 ${isCurrent ? 'shadow-lg shadow-green-500/10' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{user.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-text-primary">{user.name}</span>
            <Badge label={user.tier} />
            {isCurrent && (
              <span className="text-[10px] text-green-400 bg-green-400/10 border border-green-400/30 px-1.5 py-0.5 rounded font-medium">
                ✓ 当前用户
              </span>
            )}
          </div>
          <div className="text-xs text-text-secondary mt-0.5 font-mono">ID: {user.id}</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-3 text-xs border-b border-border pb-3">
        <div>
          <span className="text-text-secondary">历史订单</span>
          <span className="text-text-primary font-semibold ml-1">{user.orders}单</span>
        </div>
        <div>
          <span className="text-text-secondary">总消费</span>
          <span className="text-text-primary font-semibold ml-1">¥{user.totalSpend.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-text-secondary">LTV</span>
          <span
            className="font-bold ml-1"
            style={{ color: user.ltv >= 80 ? '#20c4cb' : user.ltv >= 50 ? '#4ade80' : '#6b7280' }}
          >
            {user.ltv}/100
          </span>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-1.5 mb-3">
        {user.tags.map(tag => (
          <TagBar key={tag.label} label={tag.label} weight={tag.weight} maxWeight={maxWeight} />
        ))}
      </div>

      {/* Meta */}
      <div className="text-xs text-text-secondary space-y-1 border-t border-border pt-3 mb-3">
        <div className="flex gap-1">
          <span className="text-text-secondary/60">偏好</span>
          <span className="text-text-primary">{user.preference.join(' / ')}</span>
        </div>
        <div className="flex gap-4">
          <span><span className="text-text-secondary/60">活跃</span> {user.activeTime}</span>
          <span><span className="text-text-secondary/60">位置</span> {user.location}</span>
        </div>
      </div>

      {/* Action */}
      {isCurrent ? (
        <button
          disabled
          className="w-full py-2 rounded-lg text-sm font-medium bg-green-500/15 border border-green-500/40 text-green-400 cursor-default"
        >
          ✓ 已设为当前用户
        </button>
      ) : (
        <button
          onClick={() => onSetCurrent(user.id)}
          disabled={setting}
          className="w-full py-2 rounded-lg text-sm font-medium bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
        >
          {setting ? '设置中...' : '设为当前用户'}
        </button>
      )}
    </Card>
  )
}

// ——— 主组件 ———
const UserProfiles: React.FC = () => {
  const { data: users, loading, error } = useFetch<UserProfile[]>('/users', FALLBACK_USERS)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [setting, setSetting] = useState(false)

  const displayUsers = error || loading ? FALLBACK_USERS : users

  const handleSetCurrent = async (id: string) => {
    setSetting(true)
    setCurrentUserId(id)
    try {
      await apiFetch('/users/current', {
        method: 'POST',
        body: JSON.stringify({ userId: id }),
      })
    } catch {
      // Backend may not be up yet; state change is still useful locally
    } finally {
      setSetting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">👤</span>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">模拟用户</h2>
          <p className="text-xs text-text-secondary">
            {displayUsers.length} 位用户 · 点击"设为当前用户"切换运行时用户身份
          </p>
        </div>
        {(error || loading) && (
          <span className="ml-auto text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-2 py-1 rounded">
            {loading ? '⏳ 加载中...' : '⚠️ 后端未连接，使用默认数据'}
          </span>
        )}
        {currentUserId && (
          <span className="ml-auto text-xs text-green-400 bg-green-400/10 border border-green-400/30 px-2 py-1 rounded">
            ✓ 当前用户：{displayUsers.find(u => u.id === currentUserId)?.name}
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {displayUsers.map(user => (
          <UserCard
            key={user.id}
            user={user}
            isCurrent={currentUserId === user.id}
            onSetCurrent={handleSetCurrent}
            setting={setting}
          />
        ))}
      </div>

      {/* LTV 说明 */}
      <div className="bg-surface rounded-xl border border-border p-4 text-xs text-text-secondary">
        <span className="text-text-primary font-medium">💡 LTV 说明：</span>
        <span className="text-accent font-bold"> ≥ 80</span> 触发动态制券（合约经济）；
        <span className="text-green-400 font-bold"> 50-79</span> 标准优惠；
        <span className="text-text-secondary font-bold"> &lt;50</span> 新客/低活跃。
        当前设置的"当前用户"将在 Runtime 场景执行时作为 Agent 请求方身份。
      </div>
    </div>
  )
}

export default UserProfiles
