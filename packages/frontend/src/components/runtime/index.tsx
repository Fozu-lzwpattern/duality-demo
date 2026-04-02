/**
 * Runtime 四幕场景 Tab 容器
 */
import React, { useState } from 'react'
import Scene1 from './Scene1'
import Scene2 from './Scene2'
import Scene3 from './Scene3'
import Scene4 from './Scene4'

type SceneTab = 1 | 2 | 3 | 4

const TABS: { id: SceneTab; label: string; desc: string; icon: string }[] = [
  { id: 1, label: '智能发券', desc: 'Intent → Coupon', icon: '🎟️' },
  { id: 2, label: '危险操作', desc: 'CRITICAL → Approval', icon: '🔴' },
  { id: 3, label: 'Saga 事务', desc: 'Multi-System → Rollback', icon: '🔄' },
  { id: 4, label: '合约经济', desc: 'asC × asB Negotiation', icon: '📋' },
]

const RuntimeView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SceneTab>(1)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar for Runtime scenes */}
      <div className="flex items-center gap-1 px-6 border-b border-border bg-surface shrink-0 h-10">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm rounded-t-lg transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-accent border-accent font-medium'
                : 'text-text-secondary border-transparent hover:text-text-primary'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className={`text-xs ${activeTab === tab.id ? 'text-accent/60' : 'text-text-secondary/60'}`}>
              {tab.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Scene content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 1 && <Scene1 />}
        {activeTab === 2 && <Scene2 />}
        {activeTab === 3 && <Scene3 />}
        {activeTab === 4 && <Scene4 />}
      </div>
    </div>
  )
}

export default RuntimeView
