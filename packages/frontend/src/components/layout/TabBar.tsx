import React from 'react'
import type { BuilderTab } from '../../types'

interface TabBarProps {
  active: BuilderTab
  onSwitch: (tab: BuilderTab) => void
}

const TABS: { id: BuilderTab; icon: string; label: string; desc: string }[] = [
  { id: 'coupon', icon: '🎟️', label: '优惠券系统', desc: 'Coupon System' },
  { id: 'users', icon: '👤', label: '模拟用户', desc: 'User Profiles' },
  { id: 'neural', icon: '🧠', label: 'Neural Interface', desc: 'AI Protocol' },
]

export const TabBar: React.FC<TabBarProps> = ({ active, onSwitch }) => {
  return (
    <div className="flex items-center gap-1 px-6 border-b border-border bg-surface shrink-0 h-11">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onSwitch(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition-all border-b-2 -mb-px ${
            active === tab.id
              ? 'text-accent border-accent font-medium'
              : 'text-text-secondary border-transparent hover:text-text-primary'
          }`}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
          <span className={`text-xs ${active === tab.id ? 'text-accent/60' : 'text-text-secondary/60'}`}>
            {tab.desc}
          </span>
        </button>
      ))}
    </div>
  )
}
