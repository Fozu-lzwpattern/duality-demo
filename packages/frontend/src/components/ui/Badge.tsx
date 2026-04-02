import React from 'react'

interface BadgeProps {
  label: string
  variant?: 'accent' | 'green' | 'yellow' | 'red' | 'gray'
  size?: 'sm' | 'md'
}

const variantClasses: Record<string, string> = {
  accent: 'bg-accent/20 text-accent border border-accent/40',
  green: 'bg-green-500/20 text-green-400 border border-green-500/40',
  yellow: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
  red: 'bg-red-500/20 text-red-400 border border-red-500/40',
  gray: 'bg-gray-500/20 text-gray-400 border border-gray-500/40',
}

const tierVariant: Record<string, string> = {
  Whale: 'accent',
  VIP: 'green',
  Regular: 'yellow',
  New: 'gray',
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'gray', size = 'sm' }) => {
  const v = tierVariant[label] ?? variant
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1'
  return (
    <span className={`inline-flex items-center rounded font-medium ${sizeClass} ${variantClasses[v]}`}>
      {label}
    </span>
  )
}

export const RiskBadge: React.FC<{ level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = ({ level }) => {
  const map = {
    LOW: 'bg-green-500/20 text-green-400 border border-green-500/40',
    MEDIUM: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
    HIGH: 'bg-orange-500/20 text-orange-400 border border-orange-500/40',
    CRITICAL: 'bg-red-500/20 text-red-400 border border-red-500/40',
  }
  return (
    <span className={`inline-flex items-center rounded text-xs px-1.5 py-0.5 font-bold ${map[level]}`}>
      {level}
    </span>
  )
}
