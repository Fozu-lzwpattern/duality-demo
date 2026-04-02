import React, { useState } from 'react'
import { SceneLayout } from './SceneLayout'

const USERS = [
  { id: 'alice', name: 'Alice 💎', desc: 'LTV 92 · 高价值' },
  { id: 'bob', name: 'Bob 🆕', desc: 'LTV 12 · 新用户' },
  { id: 'carol', name: 'Carol ⚡', desc: 'LTV 61 · 高频低客单' },
  { id: 'david', name: 'David 🏨', desc: 'LTV 88 · 多业务重度' },
  { id: 'eva', name: 'Eva 🌱', desc: 'LTV 55 · 成长型' },
]

const Scene1: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState('alice')

  return (
    <SceneLayout
      sceneId="1"
      title="智能发券"
      subtitle="asC 发出购餐意图 → 用户画像评估 → Gate 检查 → dynamicMint → 实时发券"
      badge="Scene 1"
      badgeColor="#20c4cb"
      runEndpoint="/scene/1/run"
      runBody={() => ({ userId: selectedUser, intent: '帮我找家日料，150以内，今晚' })}
      extraControls={
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">用户:</span>
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
      }
    />
  )
}

export default Scene1
