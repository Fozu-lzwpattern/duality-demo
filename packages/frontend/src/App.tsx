import React, { useState } from 'react'
import { TopNav } from './components/layout/TopNav'
import { TabBar } from './components/layout/TabBar'
import CouponSystem from './components/builder/CouponSystem'
import UserProfiles from './components/builder/UserProfiles'
import NeuralInterface from './components/builder/NeuralInterface'
import RuntimeView from './components/runtime/index'
import type { NavMode, BuilderTab } from './types'

const App: React.FC = () => {
  const [mode, setMode] = useState<NavMode>('builder')
  const [builderTab, setBuilderTab] = useState<BuilderTab>('coupon')

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      <TopNav mode={mode} onSwitch={setMode} />

      {/* Builder — 始终挂载，切换模式时隐藏而不卸载，保留 NeuralInterface 执行状态 */}
      <div style={{ display: mode === 'builder' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <TabBar active={builderTab} onSwitch={setBuilderTab} />
        <div className="flex-1 overflow-hidden">
          <div style={{ display: builderTab === 'coupon' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
            <CouponSystem />
          </div>
          <div style={{ display: builderTab === 'users' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
            <UserProfiles />
          </div>
          <div style={{ display: builderTab === 'neural' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
            <NeuralInterface />
          </div>
        </div>
      </div>

      {/* Runtime — 始终挂载，保留场景执行状态 */}
      <div style={{ display: mode === 'runtime' ? 'flex' : 'none', flex: 1, overflow: 'hidden', flexDirection: 'column', minHeight: 0 }}>
        <RuntimeView />
      </div>
    </div>
  )
}

export default App
