import React from 'react'
import type { NavMode } from '../../types'

interface TopNavProps {
  mode: NavMode
  onSwitch: (mode: NavMode) => void
}

export const TopNav: React.FC<TopNavProps> = ({ mode, onSwitch }) => {
  return (
    <div className="h-14 flex items-center justify-between px-6 border-b border-border bg-surface shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/50 flex items-center justify-center">
          <span className="text-accent text-xs font-bold">D</span>
        </div>
        <span className="font-semibold text-text-primary text-sm tracking-wide">
          Duality Demo
        </span>
        <span className="text-text-secondary text-xs">— Agentic Commerce</span>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-1 bg-bg border border-border rounded-lg p-1">
        <button
          onClick={() => onSwitch('builder')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            mode === 'builder'
              ? 'bg-accent text-bg shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          🏗️ 构建
        </button>
        <button
          onClick={() => onSwitch('runtime')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            mode === 'runtime'
              ? 'bg-accent text-bg shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          ⚡ 运行
        </button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
        <span>系统就绪</span>
      </div>
    </div>
  )
}
