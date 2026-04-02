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

      {mode === 'builder' && (
        <>
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
        </>
      )}

      {mode === 'runtime' && (
        <div className="flex-1 overflow-hidden">
          <RuntimeView />
        </div>
      )}
    </div>
  )
}

export default App
