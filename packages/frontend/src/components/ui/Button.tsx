import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'success'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

const variantMap = {
  primary: 'bg-accent text-bg hover:bg-accent/90 font-semibold',
  secondary: 'bg-surface border border-border text-text-primary hover:border-accent/50',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface',
  success: 'bg-green-500/20 border border-green-500/40 text-green-400 cursor-default',
}

const sizeMap = {
  sm: 'text-xs px-2.5 py-1.5',
  md: 'text-sm px-3.5 py-2',
  lg: 'text-sm px-5 py-2.5',
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg transition-colors ${variantMap[variant]} ${sizeMap[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
