import type { FastifyInstance } from 'fastify'
import { emitToScene } from '../runtime/events.js'
import { createTemplate, createCoupon, updateCoupon, addAudit } from '../coupon/store.js'
import { getUser } from '../users/presets.js'
import type { SceneEvent } from '../coupon/types.js'

async function emit(sceneId: string, event: Omit<SceneEvent, 'timestamp'>, delay = 800): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delay))
  emitToScene(sceneId, { ...event, timestamp: Date.now() })
}

export function registerScene3Routes(app: FastifyInstance): void {
  /**
   * 场景3：跨系统 Saga
   * step1: Agent请求 → "发券 + 同步会员积分"
   * step2: Saga开始，两步：issueCoupon + addPoints
   * step3: issueCoupon → 成功
   * step4: addPoints → 模拟失败（积分服务超时）
   * step5: Saga补偿 → 回滚issueCoupon（券状态→EXPIRED）
   * step6: 补偿成功，审计链记录
   * complete: {sagaResult: 'compensated', rolledBack: ['issueCoupon']}
   */
  app.post<{ Body: { userId?: string; points?: number } }>('/api/scene/3/run', async (req, reply) => {
    const userId = req.body.userId ?? 'carol'
    const points = req.body.points ?? 500
    const couponAmount = 20
    const sceneId = '3'

    reply.send({ ok: true, message: 'Scene 3 started', sceneId, userId })

    const user = getUser(userId)
    if (!user) return

    // Step 1
    await emit(sceneId, {
      type: 'step',
      step: 1,
      title: 'Agent 发出跨系统请求',
      description: `"为 ${user.name} 发 ¥${couponAmount} 外卖券 + 同步 ${points} 积分"`,
      data: { userId, userName: user.name, couponAmount, points },
    })

    // Step 2: Saga starts
    await emit(sceneId, {
      type: 'step',
      step: 2,
      title: 'Saga 事务开始',
      description: '启动分布式 Saga，包含两个原子步骤',
      data: {
        sagaId: `saga_${Date.now()}`,
        steps: ['issueCoupon', 'addPoints'],
        compensation: ['revokeCoupon', 'N/A (points not yet written)'],
      },
    })

    // Step 3: issueCoupon success
    const tmpl = createTemplate({
      name: '高频用户积分兑换券',
      businessType: '外卖',
      discountType: 'FIXED',
      discountValue: couponAmount,
      minOrderAmount: 0,
      totalStock: 1,
    })
    let coupon = createCoupon({
      templateId: tmpl.id,
      userId,
      status: 'DRAFT',
      businessType: '外卖',
      discountType: 'FIXED',
      discountValue: couponAmount,
      minOrderAmount: 0,
    })
    coupon = updateCoupon(coupon.id, { status: 'ACTIVE' })!
    coupon = updateCoupon(coupon.id, { status: 'ISSUED', issuedAt: new Date().toISOString() })!

    await emit(sceneId, {
      type: 'step',
      step: 3,
      title: '✅ Step 1: issueCoupon 成功',
      description: `券 ${coupon.id} 已发放，状态: ISSUED`,
      data: { step: 'issueCoupon', status: 'success', couponId: coupon.id, userId },
    })

    // Step 4: addPoints fails
    await emit(sceneId, {
      type: 'step',
      step: 4,
      title: '⏳ Step 2: addPoints 执行中...',
      description: '调用积分服务，等待响应……',
      data: { step: 'addPoints', points, service: 'points-service:8080' },
    }, 1200)

    await emit(sceneId, {
      type: 'error',
      step: 4,
      title: '❌ Step 2: addPoints 失败',
      description: '积分服务超时（模拟：connection timeout after 5000ms）',
      data: {
        step: 'addPoints',
        status: 'failed',
        error: 'ETIMEDOUT: points-service connection timeout',
        userId, points,
      },
    }, 600)

    // Step 5: Saga compensation
    await emit(sceneId, {
      type: 'step',
      step: 5,
      title: '🔄 Saga 触发补偿机制',
      description: '积分步骤失败，触发 Saga 补偿，回滚 issueCoupon',
      data: {
        compensating: ['issueCoupon'],
        skipping: ['addPoints (not executed)'],
      },
    })

    // Rollback: ISSUED → EXPIRED
    coupon = updateCoupon(coupon.id, {
      status: 'EXPIRED',
      expiredAt: new Date().toISOString(),
    })!

    await emit(sceneId, {
      type: 'state_change',
      step: 5,
      title: '券状态回滚：ISSUED → EXPIRED',
      description: `券 ${coupon.id} 已撤销，用户权益恢复原状`,
      data: { couponId: coupon.id, from: 'ISSUED', to: 'EXPIRED', compensated: true },
    }, 600)

    // Step 6: Audit
    const sagaResult = {
      sagaId: `saga_${Date.now()}`,
      steps: [
        { name: 'issueCoupon', status: 'compensated', compensationApplied: true },
        { name: 'addPoints', status: 'failed' },
      ],
      compensated: true,
      rolledBack: ['issueCoupon'],
    }

    await emit(sceneId, {
      type: 'audit',
      step: 6,
      title: 'Saga 补偿完成，审计链记录',
      description: '分布式事务补偿成功，数据一致性已恢复',
      data: sagaResult,
    })

    addAudit({
      sceneId,
      userId,
      action: 'SAGA_COMPENSATED',
      payload: { ...sagaResult, couponId: coupon.id },
      operator: 'agent',
      result: 'rolled_back',
    })

    await emit(sceneId, {
      type: 'complete',
      step: 6,
      title: '场景3完成 ✅',
      description: 'Saga 补偿机制正常工作，跨系统事务数据一致性保障',
      data: { sagaResult: 'compensated', rolledBack: ['issueCoupon'] },
    }, 400)
  })
}
