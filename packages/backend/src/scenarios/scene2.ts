import type { FastifyInstance } from 'fastify'
import { emitToScene } from '../runtime/events.js'
import { couponStore, addAudit, pendingApprovals, updateCoupon } from '../coupon/store.js'
import type { SceneEvent } from '../coupon/types.js'

async function emit(sceneId: string, event: Omit<SceneEvent, 'timestamp'>, delay = 800): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delay))
  emitToScene(sceneId, { ...event, timestamp: Date.now() })
}

export function registerScene2Routes(app: FastifyInstance): void {
  /**
   * 场景2：危险操作 / 人审
   * step1: Agent请求 → "清空所有券库存"
   * step2: ImpactGate评估 → {risk: 'CRITICAL', scope: 'ALL', count}
   * step3: RED_GATE_TRIGGERED → PENDING_HUMAN_APPROVAL
   * step4: 等待人工确认
   * step5: 人工确认/拒绝
   * complete: {approved: true/false}
   */

  // 触发场景2
  app.post<{ Body: { userId?: string } }>('/api/scene/2/run', async (req, reply) => {
    const userId = req.body.userId ?? 'agent'
    const sceneId = '2'

    reply.send({ ok: true, message: 'Scene 2 started', sceneId })

    const couponCount = couponStore.size || 3847

    // Step 1
    await emit(sceneId, {
      type: 'step',
      step: 1,
      title: 'Agent 发出高危请求',
      description: '"清空所有券库存"',
      data: { request: 'bulk_expire_all', scope: 'ALL', agent: 'Agent-007' },
    })

    // Step 2: ImpactGate
    await emit(sceneId, {
      type: 'gate_eval',
      step: 2,
      title: 'ImpactGate 风控评估',
      description: '检测到全局操作，升级风险评估……',
      data: { scope: 'ALL', couponCount },
    })

    const gateResult = {
      risk: 'CRITICAL' as const,
      scope: 'ALL',
      count: couponCount,
      reason: `操作将影响全部 ${couponCount} 张有效券，属于全局高危操作`,
      autoApprove: false,
      requireHumanApproval: true,
    }

    await emit(sceneId, {
      type: 'gate_eval',
      step: 2,
      title: '⚠️ 风险等级：CRITICAL',
      description: `影响范围: 全部 ${couponCount} 张券 | 自动执行: 禁止`,
      data: gateResult,
    }, 600)

    // Step 3: RED_GATE_TRIGGERED
    const approvalId = `approval_scene2_${Date.now()}`
    pendingApprovals.set(approvalId, {
      sceneId,
      request: { action: 'bulk_expire_all', scope: 'ALL', count: couponCount },
      gateResult,
      createdAt: Date.now(),
    })

    await emit(sceneId, {
      type: 'step',
      step: 3,
      title: '🚨 RED_GATE_TRIGGERED',
      description: '操作已暂停，等待人工审批',
      data: {
        approvalId,
        status: 'PENDING_HUMAN_APPROVAL',
        gate: gateResult,
        approvalUrl: `/api/approvals/${approvalId}/decide`,
      },
    }, 400)

    // Step 4: Waiting
    await emit(sceneId, {
      type: 'step',
      step: 4,
      title: '等待人工确认...',
      description: '操作挂起，等待授权人员审批。点击"批准"或"拒绝"继续。',
      data: { approvalId, waiting: true },
    }, 300)
  })

  // 场景2：人工审批结果回调
  app.post<{
    Params: { approvalId: string }
    Body: { approved: boolean; operator?: string }
  }>('/api/scene/2/approve/:approvalId', async (req, reply) => {
    const { approvalId } = req.params
    const { approved, operator = 'human' } = req.body
    const sceneId = '2'

    const approval = pendingApprovals.get(approvalId)
    if (!approval) {
      return reply.code(404).send({ ok: false, error: 'Approval not found or already processed' })
    }
    pendingApprovals.delete(approvalId)

    reply.send({ ok: true, approved, operator })

    // Step 5
    await emit(sceneId, {
      type: 'step',
      step: 5,
      title: approved ? '✅ 人工已批准' : '❌ 人工已拒绝',
      description: approved
        ? `操作员 [${operator}] 批准执行：清空所有券库存`
        : `操作员 [${operator}] 拒绝：操作已取消，数据安全`,
      data: { approved, operator, approvalId },
    }, 300)

    if (approved) {
      // Execute: expire all coupons
      const allCoupons = [...couponStore.values()]
      let expired = 0
      for (const c of allCoupons) {
        if (c.status !== 'REDEEMED' && c.status !== 'EXPIRED') {
          updateCoupon(c.id, { status: 'EXPIRED', expiredAt: new Date().toISOString() })
          expired++
        }
      }

      await emit(sceneId, {
        type: 'state_change',
        step: 5,
        title: '批量失效执行完成',
        description: `已将 ${expired} 张券状态更新为 EXPIRED`,
        data: { expiredCount: expired },
      }, 500)
    }

    addAudit({
      sceneId,
      userId: operator,
      action: approved ? 'BULK_EXPIRE_APPROVED' : 'BULK_EXPIRE_REJECTED',
      payload: { approvalId, approved },
      operator: 'human',
      result: approved ? 'success' : 'failed',
    })

    await emit(sceneId, {
      type: 'complete',
      step: 5,
      title: `场景2完成 ${approved ? '✅' : '⛔'}`,
      description: approved ? '危险操作已通过人工审批执行' : '危险操作被人工拒绝，系统安全',
      data: { approved, operator },
    }, 400)
  })
}
