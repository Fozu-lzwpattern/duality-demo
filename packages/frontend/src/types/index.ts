export type NavMode = 'builder' | 'runtime'

export type BuilderTab = 'coupon' | 'users' | 'neural'

export interface CouponStats {
  templates: number
  issued: number
  redeemed: number
  activeContracts: number
  lockedAmount: number
}

export interface UserProfile {
  id: string
  emoji: string
  name: string
  tier: 'VIP' | 'Regular' | 'New' | 'Whale'
  orders: number
  totalSpend: number
  ltv: number
  tags: { label: string; weight: number }[]
  preference: string[]
  activeTime: string
  location: string
}

export type BuilderStep =
  | 'idle'
  | 'scanning'
  | 'semantic'
  | 'statemachine'
  | 'protocol'
  | 'done'

export type NeuralView = 'graph' | 'yaml' | 'insight'

export type YamlTab = 'semantic' | 'statemachine' | 'aiprotocol'
