// ─── Coupon Domain ────────────────────────────────────────────────────────────

export type CouponStatus = 'DRAFT' | 'ACTIVE' | 'ISSUED' | 'REDEEMED' | 'PAUSED' | 'EXPIRED'

export type CouponBusiness = '外卖' | '到餐' | '酒旅' | '闪购' | '医药' | '服务零售' | '食杂零售'

export interface CouponTemplate {
  id: string
  name: string
  businessType: CouponBusiness
  discountType: 'FIXED' | 'PERCENT'
  discountValue: number       // 固定金额(元) 或 折扣率(0~1)
  minOrderAmount: number
  validFrom?: string          // ISO timestamp
  validUntil?: string         // ISO timestamp
  status: CouponStatus
  totalStock: number
  issuedCount: number
  redeemedCount: number
  createdAt: string
}

export interface Coupon {
  id: string
  templateId: string
  userId: string
  status: CouponStatus
  issuedAt?: string
  redeemedAt?: string
  expiredAt?: string
  orderId?: string            // 关联订单（核销时）
  businessType: CouponBusiness
  discountType: 'FIXED' | 'PERCENT'
  discountValue: number
  minOrderAmount: number
  validFrom?: string
  validUntil?: string
}

export interface CouponTemplateInput {
  name: string
  businessType: CouponBusiness
  discountType: 'FIXED' | 'PERCENT'
  discountValue: number
  minOrderAmount?: number
  totalStock: number
  validFrom?: string
  validUntil?: string
}

export interface BatchMintInput {
  templateId: string
  userId: string
  count: number
}

export interface DynamicMintInput {
  userId: string
  businessType: CouponBusiness
  intent: string              // 用户意图描述
  contractId: string          // 关联合约
}

export interface IssueInput {
  templateId: string
  userId: string
  count?: number
}

export interface BatchIssueInput {
  templateId: string
  userIds: string[]
}

export interface IssueByContractInput {
  contractId: string
  coupon: {
    businessType: CouponBusiness
    discountType: 'FIXED' | 'PERCENT'
    discountValue: number
    minOrderAmount: number
    validFrom?: string
    validUntil?: string
  }
}

export interface VerifyInput {
  couponId: string
  orderId: string
  userId: string
  orderAmount: number
}

export interface RedeemInput {
  couponId: string
  orderId: string
}

export interface FulfillInput {
  contractId: string
  couponId: string
}

export interface RefundInput {
  couponId: string
  reason?: string
}

export interface SetLimitInput {
  userId?: string
  templateId?: string
  maxPerUser?: number
  maxTotal?: number
}

// ─── Contract Domain ──────────────────────────────────────────────────────────

export type ContractStatus = 'PENDING' | 'NEGOTIATING' | 'STRIKE' | 'FULFILLED' | 'REJECTED' | 'EXPIRED'

export interface ContractDraft {
  discount: number
  maxBenefit: number
  window?: string
  note?: string
}

export interface ContractRound {
  round: number
  role: 'asC' | 'asB'
  type: 'intent' | 'draft' | 'counter' | 'accept' | 'reject'
  payload: Record<string, unknown>
  timestamp: number
}

export interface Contract {
  id: string
  userId: string
  intent: string
  status: ContractStatus
  currentDraft?: ContractDraft
  negotiationRounds: ContractRound[]
  couponId?: string
  createdAt: string
  updatedAt: string
}

// ─── User Domain ──────────────────────────────────────────────────────────────

export type UserTier = '高价值' | '新用户' | '高频低客单' | '多业务重度' | '成长型'

export interface PresetUser {
  id: string
  name: string
  tier: UserTier
  emoji: string
  orderCount: number
  totalSpend: number
  ltv: number
  businessTags: Partial<Record<CouponBusiness, number>>
  preferences: string[]
  activeTime: string
  location: string
}

// ─── Impact Gate ─────────────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ImpactGateResult {
  risk: RiskLevel
  ltv?: number
  amount?: number
  scope?: string
  count?: number
  reason: string
  autoApprove: boolean
  requireHumanApproval: boolean
}

// ─── Saga ────────────────────────────────────────────────────────────────────

export interface SagaStep {
  name: string
  status: 'pending' | 'success' | 'failed' | 'compensated'
  error?: string
  compensationApplied?: boolean
}

export interface SagaResult {
  sagaId: string
  steps: SagaStep[]
  compensated: boolean
  rolledBack: string[]
}

// ─── SSE Event ───────────────────────────────────────────────────────────────

export type SceneEventType = 'step' | 'state_change' | 'gate_eval' | 'contract' | 'audit' | 'error' | 'complete'

export interface SceneEvent {
  type: SceneEventType
  step: number
  title: string
  description: string
  data?: Record<string, unknown>
  timestamp: number
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string
  sceneId: string
  userId: string
  action: string
  payload: Record<string, unknown>
  operator: 'agent' | 'human'
  result: 'success' | 'failed' | 'rolled_back'
  timestamp: number
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface SystemStats {
  totalTemplates: number
  totalCoupons: number
  totalIssued: number
  totalRedeemed: number
  totalExpired: number
  byStatus: Record<CouponStatus, number>
  byBusiness: Record<CouponBusiness, number>
  pendingContracts: number
  fulfilledContracts: number
  auditEntries: number
}
