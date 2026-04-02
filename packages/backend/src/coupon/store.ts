import type {
  Coupon, CouponTemplate, Contract, AuditEntry, SystemStats,
  CouponStatus, CouponBusiness
} from './types.js'

// ─── In-Memory Store ─────────────────────────────────────────────────────────

export const templateStore = new Map<string, CouponTemplate>()
export const couponStore = new Map<string, Coupon>()
export const contractStore = new Map<string, Contract>()
export const auditStore: AuditEntry[] = []
export const pendingApprovals = new Map<string, {
  sceneId: string
  request: Record<string, unknown>
  gateResult: Record<string, unknown>
  createdAt: number
}>()

let idCounter = 1
function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${idCounter++}`
}

// ─── Template Operations ─────────────────────────────────────────────────────

export function createTemplate(data: Omit<CouponTemplate, 'id' | 'issuedCount' | 'redeemedCount' | 'createdAt' | 'status'>): CouponTemplate {
  const tmpl: CouponTemplate = {
    ...data,
    id: genId('T'),
    status: 'ACTIVE',
    issuedCount: 0,
    redeemedCount: 0,
    createdAt: new Date().toISOString(),
  }
  templateStore.set(tmpl.id, tmpl)
  return tmpl
}

export function getTemplate(id: string): CouponTemplate | undefined {
  return templateStore.get(id)
}

export function updateTemplate(id: string, patch: Partial<CouponTemplate>): CouponTemplate | undefined {
  const tmpl = templateStore.get(id)
  if (!tmpl) return undefined
  const updated = { ...tmpl, ...patch }
  templateStore.set(id, updated)
  return updated
}

// ─── Coupon Operations ───────────────────────────────────────────────────────

export function createCoupon(data: Omit<Coupon, 'id' | 'issuedAt' | 'redeemedAt' | 'expiredAt'>): Coupon {
  const coupon: Coupon = {
    ...data,
    id: genId('C'),
  }
  couponStore.set(coupon.id, coupon)
  return coupon
}

export function getCoupon(id: string): Coupon | undefined {
  return couponStore.get(id)
}

export function updateCoupon(id: string, patch: Partial<Coupon>): Coupon | undefined {
  const c = couponStore.get(id)
  if (!c) return undefined
  const updated = { ...c, ...patch }
  couponStore.set(id, updated)
  return updated
}

export function getUserCoupons(userId: string): Coupon[] {
  return [...couponStore.values()].filter(c => c.userId === userId)
}

export function getActivityCoupons(activityId: string): Coupon[] {
  // activityId maps to templateId in this simulator
  return [...couponStore.values()].filter(c => c.templateId === activityId)
}

// ─── Contract Operations ─────────────────────────────────────────────────────

export function createContract(userId: string, intent: string): Contract {
  const contract: Contract = {
    id: genId('CT'),
    userId,
    intent,
    status: 'PENDING',
    negotiationRounds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  contractStore.set(contract.id, contract)
  return contract
}

export function getContract(id: string): Contract | undefined {
  return contractStore.get(id)
}

export function updateContract(id: string, patch: Partial<Contract>): Contract | undefined {
  const c = contractStore.get(id)
  if (!c) return undefined
  const updated = { ...c, ...patch, updatedAt: new Date().toISOString() }
  contractStore.set(id, updated)
  return updated
}

// ─── Audit Operations ────────────────────────────────────────────────────────

export function addAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
  const e: AuditEntry = {
    ...entry,
    id: genId('A'),
    timestamp: Date.now(),
  }
  auditStore.push(e)
  return e
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export function getStats(): SystemStats {
  const coupons = [...couponStore.values()]
  const byStatus = {} as Record<CouponStatus, number>
  const byBusiness = {} as Record<CouponBusiness, number>

  for (const c of coupons) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1
    byBusiness[c.businessType] = (byBusiness[c.businessType] || 0) + 1
  }

  return {
    totalTemplates: templateStore.size,
    totalCoupons: couponStore.size,
    totalIssued: coupons.filter(c => c.status === 'ISSUED').length,
    totalRedeemed: coupons.filter(c => c.status === 'REDEEMED').length,
    totalExpired: coupons.filter(c => c.status === 'EXPIRED').length,
    byStatus,
    byBusiness,
    pendingContracts: [...contractStore.values()].filter(c => c.status === 'PENDING' || c.status === 'NEGOTIATING').length,
    fulfilledContracts: [...contractStore.values()].filter(c => c.status === 'FULFILLED').length,
    auditEntries: auditStore.length,
  }
}

// ─── Reset ───────────────────────────────────────────────────────────────────

export function resetAll(): void {
  templateStore.clear()
  couponStore.clear()
  contractStore.clear()
  auditStore.length = 0
  pendingApprovals.clear()
  idCounter = 1
}
