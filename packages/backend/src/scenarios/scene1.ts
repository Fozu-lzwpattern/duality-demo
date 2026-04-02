import type { FastifyInstance } from 'fastify'
import { emitToScene } from '../runtime/events.js'
import { createTemplate, createCoupon, updateCoupon, addAudit } from '../coupon/store.js'
import { getUser } from '../users/presets.js'
import type { SceneEvent } from '../coupon/types.js'

// Helper: emit with delay for cinematic effect
async function emit(sceneId: string, event: Omit<SceneEvent, 'timestamp'>, delay = 800): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delay))
  emitToScene(sceneId, { ...event, timestamp: Date.now() })
}

export function registerScene1Routes(app: FastifyInstance): void {
  /**
   * 场景1：智能发券
   * step1: Agent请求 → "给VIP用户发50元券"
   * step2: ImpactGate评估 → {risk: 'LOW', ltv: 92, amount: 50}
   * step3: AUTO_APPROVED
   * step4: 调用 issue API → 券状态 DRAFT→ACTIVE→ISSUED
   * step5: 审计链写入
   * complete: {couponId, userId, amount: 50}
   */
  app.post<{
    Body: { userId?: string; amount?: number }
  }>('/api/scene/1/run', async (req, reply) => {
    const userId = req.body.userId ?? 'alice'
    const amount = req.body.amount ?? 50
    const sceneId = '1'

    // Kick off async - return immediately
    reply.send({ ok: true, message: 'Scene 1 started', sceneId, userId, amount })

    const user = getUser(userId)
    if (!user) return

    // Step 1
    await emit(sceneId, {
      type: 'step',
      step: 1,
      title: 'Agent 发出请求',
      description: `"给 ${user.name}（${user.tier} ${user.emoji}）发 ${amount} 元券"`,
      data: { userId, userName: user.name, tier: user.tier, amount, intent: '定向营销激励' },
    })

    // Step 2: ImpactGate
    await emit(sceneId, {
      type: 'gate_eval',
      step: 2,
      title: 'ImpactGate 风控评估',
      description: '评估操作风险等级……',
      data: { evaluating: true, userId, amount },
    })

    const gateResult = {
      risk: 'LOW' as const,
      ltv: user.ltv,
      amount,
      reason: `用户 LTV=${user.ltv}，属高价值用户；金额 ¥${amount} 低于风控阈值`,
      autoApprove: true,
      requireHumanApproval: false,
    }

    await emit(sceneId, {
      type: 'gate_eval',
      step: 2,
      title: 'ImpactGate 评估完成',
      description: `风险等级: ${gateResult.risk} | LTV: ${gateResult.ltv} | 金额: ¥${amount}`,
      data: gateResult,
    })

    // Step 3: AUTO_APPROVED
    await emit(sceneId, {
      type: 'step',
      step: 3,
      title: 'AUTO_APPROVED',
      description: '风险低，系统自动放行，无需人工审批',
      data: { autoApproved: true, gate: gateResult },
    })

    // Step 4: Issue — DRAFT → ACTIVE → ISSUED
    const tmpl = createTemplate({
      name: `VIP优惠券_${amount}元`,
      businessType: '外卖',
      discountType: 'FIXED',
      discountValue: amount,
      minOrderAmount: 0,
      totalStock: 1,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 86400_000).toISOString(),
    })

    await emit(sceneId, {
      type: 'state_change',
      step: 4,
      title: '券状态流转：DRAFT',
      description: `创建券模板 ${tmpl.id}，初始状态 DRAFT`,
      data: { state: 'DRAFT', templateId: tmpl.id },
    })

    let coupon = createCoupon({
      templateId: tmpl.id,
      userId,
      status: 'DRAFT',
      businessType: tmpl.businessType,
      discountType: tmpl.discountType,
      discountValue: tmpl.discountValue,
      minOrderAmount: tmpl.minOrderAmount,
      validFrom: tmpl.validFrom,
      validUntil: tmpl.validUntil,
    })

    await emit(sceneId, {
      type: 'state_change',
      step: 4,
      title: '券状态流转：DRAFT → ACTIVE',
      description: '券模板激活',
      data: { couponId: coupon.id, state: 'ACTIVE' },
    }, 500)

    coupon = updateCoupon(coupon.id, { status: 'ACTIVE' })!

    await emit(sceneId, {
      type: 'state_change',
      step: 4,
      title: '券状态流转：ACTIVE → ISSUED',
      description: `券已发放给 ${user.name}`,
      data: { couponId: coupon.id, state: 'ISSUED', userId, issuedAt: new Date().toISOString() },
    }, 600)

    coupon = updateCoupon(coupon.id, { status: 'ISSUED', issuedAt: new Date().toISOString() })!

    // Step 5: Audit
    await emit(sceneId, {
      type: 'audit',
      step: 5,
      title: '审计链写入',
      description: '操作记录已写入不可篡改审计链',
      data: {
        action: 'COUPON_ISSUED',
        userId,
        couponId: coupon.id,
        amount,
        operator: 'agent',
        gate: gateResult,
      },
    })

    addAudit({
      sceneId,
      userId,
      action: 'COUPON_ISSUED',
      payload: { couponId: coupon.id, amount, gateResult },
      operator: 'agent',
      result: 'success',
    })

    // Complete
    await emit(sceneId, {
      type: 'complete',
      step: 5,
      title: '场景1完成 ✅',
      description: `成功为 ${user.name} 发放 ¥${amount} 优惠券`,
      data: { couponId: coupon.id, userId, amount, status: 'ISSUED' },
    }, 400)
  })
}
