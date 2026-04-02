import type { FastifyInstance } from 'fastify'
import {
  templateStore, couponStore, contractStore, auditStore,
  createTemplate, getTemplate, updateTemplate,
  createCoupon, getCoupon, updateCoupon,
  getUserCoupons, getActivityCoupons,
  createContract, getContract, updateContract,
  addAudit, getStats, resetAll, pendingApprovals,
} from './store.js'
import { getUser, getAllUsers } from '../users/presets.js'
import type {
  CouponTemplateInput, BatchMintInput, DynamicMintInput,
  IssueInput, BatchIssueInput, IssueByContractInput,
  VerifyInput, RedeemInput, FulfillInput, RefundInput, SetLimitInput,
  ImpactGateResult, CouponBusiness
} from './types.js'

// ─── ImpactGate Helper ────────────────────────────────────────────────────────

function evalImpactGate(params: {
  action: string
  scope?: string
  userId?: string
  amount?: number
}): ImpactGateResult {
  const { action, scope, userId, amount = 0 } = params
  const user = userId ? getUser(userId) : undefined

  if (scope === 'ALL' || action === 'bulk_expire') {
    return {
      risk: 'CRITICAL',
      scope: 'ALL',
      count: couponStore.size || 3847,
      reason: '操作影响所有券库存，属于高危全局操作',
      autoApprove: false,
      requireHumanApproval: true,
    }
  }

  if (amount > 500) {
    return {
      risk: 'HIGH',
      ltv: user?.ltv,
      amount,
      reason: '单张券金额超过500元，需要人工审批',
      autoApprove: false,
      requireHumanApproval: true,
    }
  }

  if (amount > 100) {
    return {
      risk: 'MEDIUM',
      ltv: user?.ltv,
      amount,
      reason: '中等金额操作，建议人工确认',
      autoApprove: false,
      requireHumanApproval: true,
    }
  }

  return {
    risk: 'LOW',
    ltv: user?.ltv,
    amount,
    reason: '低风险操作，自动执行',
    autoApprove: true,
    requireHumanApproval: false,
  }
}

// ─── Route Registration ───────────────────────────────────────────────────────

export function registerCouponRoutes(app: FastifyInstance): void {

  // ── 制券组 ──────────────────────────────────────────────────────────────────

  // POST /api/coupon/templates — 创建券模板
  app.post<{ Body: CouponTemplateInput }>('/api/coupon/templates', async (req, reply) => {
    const body = req.body
    const tmpl = createTemplate({
      name: body.name,
      businessType: body.businessType,
      discountType: body.discountType,
      discountValue: body.discountValue,
      minOrderAmount: body.minOrderAmount ?? 0,
      totalStock: body.totalStock,
      validFrom: body.validFrom,
      validUntil: body.validUntil,
    })
    return reply.code(201).send({ ok: true, data: tmpl })
  })

  // POST /api/coupon/batch-mint — 批量制券（计划经济）
  app.post<{ Body: BatchMintInput }>('/api/coupon/batch-mint', async (req, reply) => {
    const { templateId, userId, count } = req.body
    const tmpl = getTemplate(templateId)
    if (!tmpl) return reply.code(404).send({ ok: false, error: 'Template not found' })
    if (tmpl.status !== 'ACTIVE') return reply.code(400).send({ ok: false, error: 'Template not active' })

    const coupons = []
    for (let i = 0; i < count; i++) {
      const c = createCoupon({
        templateId,
        userId,
        status: 'DRAFT',
        businessType: tmpl.businessType,
        discountType: tmpl.discountType,
        discountValue: tmpl.discountValue,
        minOrderAmount: tmpl.minOrderAmount,
        validFrom: tmpl.validFrom,
        validUntil: tmpl.validUntil,
      })
      coupons.push(c)
    }

    return reply.code(201).send({ ok: true, data: { count: coupons.length, coupons } })
  })

  // POST /api/coupon/dynamic-mint — 实时动态制券（合约经济核心）
  app.post<{ Body: DynamicMintInput }>('/api/coupon/dynamic-mint', async (req, reply) => {
    const { userId, businessType, intent, contractId } = req.body
    const contract = getContract(contractId)
    if (!contract) return reply.code(404).send({ ok: false, error: 'Contract not found' })
    if (contract.status !== 'STRIKE') return reply.code(400).send({ ok: false, error: 'Contract not in STRIKE status' })

    const draft = contract.currentDraft!
    const coupon = createCoupon({
      templateId: `dynamic_${contractId}`,
      userId,
      status: 'ACTIVE',  // 动态制券直接ACTIVE
      businessType,
      discountType: 'FIXED',
      discountValue: draft.maxBenefit,
      minOrderAmount: 0,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),  // 24h有效
    })

    return reply.code(201).send({ ok: true, data: { coupon, contractId, intent } })
  })

  // ── 发券组 ──────────────────────────────────────────────────────────────────

  // POST /api/coupon/issue — 发券给用户
  app.post<{ Body: IssueInput }>('/api/coupon/issue', async (req, reply) => {
    const { templateId, userId, count = 1 } = req.body
    const tmpl = getTemplate(templateId)
    if (!tmpl) return reply.code(404).send({ ok: false, error: 'Template not found' })
    if (tmpl.status !== 'ACTIVE') return reply.code(400).send({ ok: false, error: 'Template not active' })

    // Create coupon DRAFT → ACTIVE → ISSUED
    const coupons = []
    for (let i = 0; i < count; i++) {
      let c = createCoupon({
        templateId,
        userId,
        status: 'DRAFT',
        businessType: tmpl.businessType,
        discountType: tmpl.discountType,
        discountValue: tmpl.discountValue,
        minOrderAmount: tmpl.minOrderAmount,
        validFrom: tmpl.validFrom,
        validUntil: tmpl.validUntil,
      })
      // DRAFT → ACTIVE
      c = updateCoupon(c.id, { status: 'ACTIVE' })!
      // ACTIVE → ISSUED
      c = updateCoupon(c.id, { status: 'ISSUED', issuedAt: new Date().toISOString() })!
      updateTemplate(templateId, { issuedCount: (tmpl.issuedCount || 0) + 1 })
      coupons.push(c)
    }

    return reply.code(201).send({ ok: true, data: { issued: coupons.length, coupons } })
  })

  // POST /api/coupon/batch-issue — 批量发券
  app.post<{ Body: BatchIssueInput }>('/api/coupon/batch-issue', async (req, reply) => {
    const { templateId, userIds } = req.body
    const tmpl = getTemplate(templateId)
    if (!tmpl) return reply.code(404).send({ ok: false, error: 'Template not found' })

    const results: Array<{ userId: string; couponId: string; status: string }> = []
    for (const uid of userIds) {
      let c = createCoupon({
        templateId,
        userId: uid,
        status: 'DRAFT',
        businessType: tmpl.businessType,
        discountType: tmpl.discountType,
        discountValue: tmpl.discountValue,
        minOrderAmount: tmpl.minOrderAmount,
        validFrom: tmpl.validFrom,
        validUntil: tmpl.validUntil,
      })
      c = updateCoupon(c.id, { status: 'ACTIVE' })!
      c = updateCoupon(c.id, { status: 'ISSUED', issuedAt: new Date().toISOString() })!
      results.push({ userId: uid, couponId: c.id, status: c.status })
    }

    return reply.code(201).send({ ok: true, data: { issued: results.length, results } })
  })

  // POST /api/coupon/issue-by-contract — 按合约发券
  app.post<{ Body: IssueByContractInput }>('/api/coupon/issue-by-contract', async (req, reply) => {
    const { contractId, coupon: couponSpec } = req.body
    const contract = getContract(contractId)
    if (!contract) return reply.code(404).send({ ok: false, error: 'Contract not found' })
    if (contract.status !== 'STRIKE') return reply.code(400).send({ ok: false, error: 'Contract must be in STRIKE status to issue' })

    let coupon = createCoupon({
      templateId: `contract_${contractId}`,
      userId: contract.userId,
      status: 'ACTIVE',
      ...couponSpec,
    })
    coupon = updateCoupon(coupon.id, { status: 'ISSUED', issuedAt: new Date().toISOString() })!

    updateContract(contractId, { couponId: coupon.id, status: 'FULFILLED' })

    return reply.code(201).send({ ok: true, data: { coupon, contractId, status: 'FULFILLED' } })
  })

  // ── 核销组 ──────────────────────────────────────────────────────────────────

  // POST /api/coupon/verify — 校验券是否可用
  app.post<{ Body: VerifyInput }>('/api/coupon/verify', async (req, reply) => {
    const { couponId, orderId, userId, orderAmount } = req.body
    const coupon = getCoupon(couponId)
    if (!coupon) return reply.code(404).send({ ok: false, valid: false, reason: 'Coupon not found' })
    if (coupon.userId !== userId) return reply.send({ ok: true, valid: false, reason: 'Coupon does not belong to user' })
    if (coupon.status !== 'ISSUED') return reply.send({ ok: true, valid: false, reason: `Coupon status is ${coupon.status}` })
    if (orderAmount < coupon.minOrderAmount) return reply.send({ ok: true, valid: false, reason: `Order amount ${orderAmount} below minimum ${coupon.minOrderAmount}` })

    const now = Date.now()
    if (coupon.validFrom && new Date(coupon.validFrom).getTime() > now) {
      return reply.send({ ok: true, valid: false, reason: 'Coupon not yet valid' })
    }
    if (coupon.validUntil && new Date(coupon.validUntil).getTime() < now) {
      updateCoupon(couponId, { status: 'EXPIRED', expiredAt: new Date().toISOString() })
      return reply.send({ ok: true, valid: false, reason: 'Coupon expired' })
    }

    const benefit = coupon.discountType === 'FIXED'
      ? coupon.discountValue
      : Math.floor(orderAmount * (1 - coupon.discountValue) * 100) / 100

    return reply.send({ ok: true, valid: true, coupon, benefit, orderId })
  })

  // POST /api/coupon/redeem — 核销券
  app.post<{ Body: RedeemInput }>('/api/coupon/redeem', async (req, reply) => {
    const { couponId, orderId } = req.body
    const coupon = getCoupon(couponId)
    if (!coupon) return reply.code(404).send({ ok: false, error: 'Coupon not found' })
    if (coupon.status !== 'ISSUED') return reply.code(400).send({ ok: false, error: `Cannot redeem coupon in status ${coupon.status}` })

    const updated = updateCoupon(couponId, {
      status: 'REDEEMED',
      redeemedAt: new Date().toISOString(),
      orderId,
    })
    return reply.send({ ok: true, data: updated })
  })

  // GET /api/coupon/eligibility/:userId — 检查用户资格
  app.get<{ Params: { userId: string } }>('/api/coupon/eligibility/:userId', async (req, reply) => {
    const { userId } = req.params
    const user = getUser(userId)
    if (!user) return reply.code(404).send({ ok: false, error: 'User not found' })

    const userCoupons = getUserCoupons(userId)
    const activeCoupons = userCoupons.filter(c => c.status === 'ISSUED')
    const redeemedCount = userCoupons.filter(c => c.status === 'REDEEMED').length

    return reply.send({
      ok: true,
      data: {
        userId,
        user,
        eligible: true,
        activeCouponsCount: activeCoupons.length,
        redeemedCount,
        ltv: user.ltv,
        tier: user.tier,
        maxBenefitAllowed: Math.min(user.ltv * 0.4, 50),  // 场景4规则
      }
    })
  })

  // ── 查询组 ──────────────────────────────────────────────────────────────────

  // GET /api/coupon/stats — 系统统计（需要在 :id 之前注册）
  app.get('/api/coupon/stats', async (_req, reply) => {
    return reply.send({ ok: true, data: getStats() })
  })

  // GET /api/coupon/user/:userId — 查询用户所有券
  app.get<{ Params: { userId: string } }>('/api/coupon/user/:userId', async (req, reply) => {
    const coupons = getUserCoupons(req.params.userId)
    return reply.send({ ok: true, data: coupons })
  })

  // GET /api/coupon/activity/:activityId — 查询活动下的券
  app.get<{ Params: { activityId: string } }>('/api/coupon/activity/:activityId', async (req, reply) => {
    const coupons = getActivityCoupons(req.params.activityId)
    return reply.send({ ok: true, data: coupons })
  })

  // GET /api/coupon/:id — 查询单张券
  app.get<{ Params: { id: string } }>('/api/coupon/:id', async (req, reply) => {
    const coupon = getCoupon(req.params.id)
    if (!coupon) return reply.code(404).send({ ok: false, error: 'Coupon not found' })
    return reply.send({ ok: true, data: coupon })
  })

  // ── 管控组 ──────────────────────────────────────────────────────────────────

  // POST /api/coupon/:id/pause — 暂停券
  app.post<{ Params: { id: string } }>('/api/coupon/:id/pause', async (req, reply) => {
    const coupon = getCoupon(req.params.id)
    if (!coupon) return reply.code(404).send({ ok: false, error: 'Coupon not found' })
    if (coupon.status !== 'ACTIVE' && coupon.status !== 'ISSUED') {
      return reply.code(400).send({ ok: false, error: `Cannot pause coupon in status ${coupon.status}` })
    }
    const updated = updateCoupon(req.params.id, { status: 'PAUSED' })
    return reply.send({ ok: true, data: updated })
  })

  // POST /api/coupon/:id/resume — 恢复券
  app.post<{ Params: { id: string } }>('/api/coupon/:id/resume', async (req, reply) => {
    const coupon = getCoupon(req.params.id)
    if (!coupon) return reply.code(404).send({ ok: false, error: 'Coupon not found' })
    if (coupon.status !== 'PAUSED') {
      return reply.code(400).send({ ok: false, error: `Cannot resume coupon in status ${coupon.status}` })
    }
    const updated = updateCoupon(req.params.id, { status: 'ACTIVE' })
    return reply.send({ ok: true, data: updated })
  })

  // POST /api/coupon/:id/expire — 强制失效
  app.post<{ Params: { id: string } }>('/api/coupon/:id/expire', async (req, reply) => {
    const coupon = getCoupon(req.params.id)
    if (!coupon) return reply.code(404).send({ ok: false, error: 'Coupon not found' })
    if (coupon.status === 'REDEEMED') {
      return reply.code(400).send({ ok: false, error: 'Cannot expire already redeemed coupon' })
    }
    const updated = updateCoupon(req.params.id, { status: 'EXPIRED', expiredAt: new Date().toISOString() })
    return reply.send({ ok: true, data: updated })
  })

  // POST /api/coupon/set-limit — 设置发放限制
  app.post<{ Body: SetLimitInput }>('/api/coupon/set-limit', async (req, reply) => {
    // In-memory: store limits config (simplified)
    return reply.send({
      ok: true,
      data: { message: 'Limit configured', config: req.body }
    })
  })

  // ── 清算组 ──────────────────────────────────────────────────────────────────

  // POST /api/coupon/fulfill — 合约履约
  app.post<{ Body: FulfillInput }>('/api/coupon/fulfill', async (req, reply) => {
    const { contractId, couponId } = req.body
    const contract = getContract(contractId)
    if (!contract) return reply.code(404).send({ ok: false, error: 'Contract not found' })
    const coupon = getCoupon(couponId)
    if (!coupon) return reply.code(404).send({ ok: false, error: 'Coupon not found' })

    updateContract(contractId, { status: 'FULFILLED', couponId })
    addAudit({
      sceneId: 'scene4',
      userId: contract.userId,
      action: 'CONTRACT_FULFILLED',
      payload: { contractId, couponId },
      operator: 'agent',
      result: 'success',
    })

    return reply.send({ ok: true, data: { contractId, couponId, status: 'FULFILLED' } })
  })

  // POST /api/coupon/refund — 退款撤券
  app.post<{ Body: RefundInput }>('/api/coupon/refund', async (req, reply) => {
    const { couponId, reason } = req.body
    const coupon = getCoupon(couponId)
    if (!coupon) return reply.code(404).send({ ok: false, error: 'Coupon not found' })
    if (coupon.status === 'EXPIRED') return reply.code(400).send({ ok: false, error: 'Coupon already expired' })

    const updated = updateCoupon(couponId, {
      status: 'EXPIRED',
      expiredAt: new Date().toISOString(),
    })
    addAudit({
      sceneId: 'refund',
      userId: coupon.userId,
      action: 'COUPON_REFUNDED',
      payload: { couponId, reason },
      operator: 'human',
      result: 'success',
    })

    return reply.send({ ok: true, data: { coupon: updated, reason, refunded: true } })
  })

  // ── Impact Gate API ─────────────────────────────────────────────────────────

  app.post<{ Body: { action: string; scope?: string; userId?: string; amount?: number } }>(
    '/api/gate/evaluate',
    async (req, reply) => {
      const result = evalImpactGate(req.body)
      return reply.send({ ok: true, data: result })
    }
  )

  // ── Pending Approval ────────────────────────────────────────────────────────

  app.get('/api/approvals', async (_req, reply) => {
    const list = [...pendingApprovals.entries()].map(([id, data]) => ({ id, ...data }))
    return reply.send({ ok: true, data: list })
  })

  app.post<{ Params: { id: string }; Body: { approved: boolean; operator?: string } }>(
    '/api/approvals/:id/decide',
    async (req, reply) => {
      const { id } = req.params
      const { approved, operator = 'human' } = req.body
      const approval = pendingApprovals.get(id)
      if (!approval) return reply.code(404).send({ ok: false, error: 'Approval not found' })
      pendingApprovals.delete(id)
      addAudit({
        sceneId: approval.sceneId,
        userId: 'system',
        action: approved ? 'HUMAN_APPROVED' : 'HUMAN_REJECTED',
        payload: { approvalId: id, ...approval.request },
        operator: 'human',
        result: approved ? 'success' : 'failed',
      })
      return reply.send({ ok: true, data: { approved, operator, approvalId: id } })
    }
  )
}
