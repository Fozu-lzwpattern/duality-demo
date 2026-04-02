import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  highlighted?: boolean
}

export const Card: React.FC<CardProps> = ({ children, className = '', highlighted = false }) => {
  return (
    <div
      className={`rounded-xl border ${
        highlighted
          ? 'border-green-500/60 bg-surface'
          : 'border-border bg-surface'
      } p-4 ${className}`}
    >
      {children}
    </div>
  )
}
