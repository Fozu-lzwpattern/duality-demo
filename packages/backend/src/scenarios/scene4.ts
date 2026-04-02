import EventEmitter from 'events'
import type { FastifyInstance } from 'fastify'
import { emitToScene } from '../runtime/events.js'
import {
  createContract, getContract, updateContract,
  createCoupon, updateCoupon, addAudit
} from '../coupon/store.js'
import { getUser } from '../users/presets.js'
import type { SceneEvent, ContractRound } from '../coupon/types.js'

// ─── Manual Mode: per-contract response emitters ──────────────────────────────
const manualEmitters = new Map<string, EventEmitter>()

type ManualDecision = { action: 'accept' | 'counter' | 'reject'; counterText?: string }

async function waitForManualResponse(contractId: string, timeoutMs = 60000): Promise<ManualDecision> {
  const emitter = manualEmitters.get(contractId)
  if (!emitter) return { action: 'accept' }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ action: 'accept' }), timeoutMs)
    emitter.once('decision', (d: ManualDecision) => {
      clearTimeout(timer)
      resolve(d)
    })
  })
}

async function emit(sceneId: string, event: Omit<SceneEvent, 'timestamp'>, delay = 900): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delay))
  emitToScene(sceneId, { ...event, timestamp: Date.now() })
}

async function executeContractStrike(
  sceneId: string,
  contractId: string,
  userId: string,
  finalBenefit: number,
  rounds: number,
  intent: string
): Promise<void> {
  updateContract(contractId, { status: 'STRIKE' })

  await emit(sceneId, {
    type: 'contract',
    step: 7,
    title: '🤝 合约成交：STRIKE',
    description: `双方达成协议，最终让利 ¥${finalBenefit}`,
    data: { contractId, status: 'STRIKE', finalBenefit, rounds },
  }, 600)

  // dynamicMint
  const coupon = createCoupon({
    templateId: `dynamic_${contractId}`,
    userId,
    status: 'ACTIVE',
    businessType: '到餐',
    discountType: 'FIXED',
    discountValue: finalBenefit,
    minOrderAmount: 0,
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  })

  await emit(sceneId, {
    type: 'step',
    step: 8,
    title: '⚡ dynamicMint — 实时制券',
    description: `合约经济核心：按协商结果实时铸造定制券，非预制库存`,
    data: {
      couponId: coupon.id,
      businessType: '到餐',
      discountValue: finalBenefit,
      validWindow: '4小时',
      minted: 'on-demand',
    },
  })

  // issueByContract
  const issuedCoupon = updateCoupon(coupon.id, {
    status: 'ISSUED',
    issuedAt: new Date().toISOString(),
  })!

  updateContract(contractId, {
    status: 'FULFILLED',
    couponId: coupon.id,
  })

  await emit(sceneId, {
    type: 'state_change',
    step: 9,
    title: '发券完成：issueByContract → ISSUED',
    description: `合约履约，券状态 ACTIVE → ISSUED，合约状态 → FULFILLED`,
    data: {
      couponId: issuedCoupon.id,
      couponStatus: 'ISSUED',
      contractId,
      contractStatus: 'FULFILLED',
    },
  }, 500)

  const contract = getContract(contractId)!
  await emit(sceneId, {
    type: 'audit',
    step: 10,
    title: '审计链：完整协商记录',
    description: `${rounds} 轮协商，全程不可篡改记录`,
    data: {
      contractId,
      rounds,
      negotiationRounds: contract.negotiationRounds,
      finalBenefit,
      couponId: issuedCoupon.id,
    },
  }, 400)

  addAudit({
    sceneId,
    userId,
    action: 'CONTRACT_FULFILLED',
    payload: {
      contractId,
      couponId: issuedCoupon.id,
      finalBenefit,
      rounds,
      intent,
      negotiationRounds: contract.negotiationRounds,
    },
    operator: 'agent',
    result: 'success',
  })

  await emit(sceneId, {
    type: 'complete',
    step: 11,
    title: '场景4完成 ✅',
    description: `合约经济全链路：意图→协商→成交→实时制券→发券→履约`,
    data: {
      contractId,
      rounds,
      finalBenefit,
      couponId: issuedCoupon.id,
      status: 'FULFILLED',
    },
  }, 400)
}

export function registerScene4Routes(app: FastifyInstance): void {
  /**
   * 场景4：合约协商（含反询，2轮）
   * asC 发出意图 → asB 评估画像 → 草案v1 → 反询 → 草案v2 → STRIKE
   * → dynamicMint → issueByContract → FULFILLED
   *
   * mode: 'auto' — 全自动（默认）| 'manual' — 草案出现后暂停等待前端 POST /api/scene/4/respond
   */
  app.post<{
    Body: {
      userId?: string
      intent?: string
      autoAccept?: boolean
      mode?: 'auto' | 'manual'
    }
  }>('/api/scene/4/run', async (req, reply) => {
    const userId = req.body?.userId ?? 'alice'
    const intent = req.body?.intent ?? '日料，150以内，今晚'
    const mode = req.body?.mode ?? 'auto'
    const autoAccept = req.body?.autoAccept ?? (mode === 'auto' ? false : false)
    const sceneId = '4'

    reply.send({ ok: true, message: 'Scene 4 started', sceneId, userId, intent, mode, autoAccept })

    // Setup manual emitter before async work
    if (mode === 'manual') {
      const emitter = new EventEmitter()
      manualEmitters.set('current', emitter) // simple key; one active scene at a time
    }

    const user = getUser(userId)
    if (!user) return

    const contract = createContract(userId, intent)
    updateContract(contract.id, { status: 'NEGOTIATING' })

    // Step 1: asC intent
    await emit(sceneId, {
      type: 'contract',
      step: 1,
      title: 'asC 发出意图（Round 1）',
      description: `用户侧 Agent 发起合约意图`,
      data: {
        role: 'asC',
        type: 'intent',
        contractId: contract.id,
        intent,
        userId,
        userName: user.name,
        tier: user.tier,
      },
    })

    const round1_intent: ContractRound = {
      round: 1,
      role: 'asC',
      type: 'intent',
      payload: { intent, userId },
      timestamp: Date.now(),
    }
    updateContract(contract.id, {
      negotiationRounds: [round1_intent],
      status: 'NEGOTIATING',
    })

    // Step 2: asB evaluates
    await emit(sceneId, {
      type: 'contract',
      step: 2,
      title: 'asB 评估用户画像',
      description: '商家侧 Agent 分析用户 LTV、业务标签、时段匹配度',
      data: {
        role: 'asB',
        ltv: user.ltv,
        orderCount: user.orderCount,
        businessTags: user.businessTags,
        timeSlot: '19:00-22:00（工作日晚间匹配）',
        supplyScore: 85,
        evaluating: true,
      },
    })

    // Step 3: asB draft v1
    const draft1 = {
      discount: 0.85,
      maxBenefit: 30,
      window: '19:00-21:00',
      note: '基于 LTV 和日料品类供给',
    }

    await emit(sceneId, {
      type: 'contract',
      step: 3,
      title: 'asB 生成草案 v1',
      description: `折扣 ${(draft1.discount * 10).toFixed(1)} 折，最大让利 ¥${draft1.maxBenefit}，有效窗口 ${draft1.window}`,
      data: { role: 'asB', draft: draft1, round: 1 },
    })

    const round1_draft: ContractRound = {
      round: 1,
      role: 'asB',
      type: 'draft',
      payload: { draft: draft1 },
      timestamp: Date.now(),
    }

    const currentContract = getContract(contract.id)!
    updateContract(contract.id, {
      currentDraft: draft1,
      negotiationRounds: [...currentContract.negotiationRounds, round1_draft],
    })

    // ─── Decide what asC does after draft v1 ─────────────────────────────────
    let decision1: ManualDecision = { action: 'counter', counterText: '能不能再多¥6？' }
    if (mode === 'manual') {
      // Signal front-end that we're waiting
      await emit(sceneId, {
        type: 'contract',
        step: 3,
        title: '⏸ 等待您的决策...',
        description: '请在合约面板选择「接受」或「反询」',
        data: { waiting: true, contractId: contract.id, draft: draft1 },
      }, 0)
      decision1 = await waitForManualResponse('current')
    }

    if (autoAccept || decision1.action === 'accept') {
      await emit(sceneId, {
        type: 'contract',
        step: 4,
        title: 'asC 自动接受草案 v1',
        description: `接受 ¥${draft1.maxBenefit} 方案，进入合约成交阶段`,
        data: { role: 'asC', decision: 'accept', draft: draft1 },
      })
      manualEmitters.delete('current')
      await executeContractStrike(sceneId, contract.id, userId, draft1.maxBenefit, 1, intent)
    } else {
      const counterText = decision1.counterText ?? '能不能再多¥6？'
      // Step 4: asC counter-offer
      await emit(sceneId, {
        type: 'contract',
        step: 4,
        title: 'asC 发出反询（Round 2）',
        description: `用户侧 Agent 发起反向询价：${counterText}`,
        data: { role: 'asC', type: 'counter', counter: counterText, currentBenefit: draft1.maxBenefit },
      })

      const round2_counter: ContractRound = {
        round: 2,
        role: 'asC',
        type: 'counter',
        payload: { counter: counterText, targetBenefit: 36 },
        timestamp: Date.now(),
      }
      const c2 = getContract(contract.id)!
      updateContract(contract.id, {
        negotiationRounds: [...c2.negotiationRounds, round2_counter],
      })

      // Step 5: asB re-evaluate
      const maxAllowed = Math.min(user.ltv * 0.4, 50)

      await emit(sceneId, {
        type: 'contract',
        step: 5,
        title: 'asB 重新评估让利空间',
        description: `检查让利上限规则：maxAllowed = min(LTV×0.4, 50) = min(${user.ltv}×0.4, 50) = ${maxAllowed.toFixed(1)}`,
        data: {
          role: 'asB',
          ltv: user.ltv,
          formula: `min(${user.ltv} × 0.4, 50)`,
          maxAllowed,
          requested: 36,
          canGrant: maxAllowed >= 35,
        },
      })

      // Step 6: asB draft v2
      const finalBenefit = 35
      const draft2 = {
        discount: 0.85,
        maxBenefit: finalBenefit,
        window: '19:00-21:00',
        note: '已达让利上限',
      }

      await emit(sceneId, {
        type: 'contract',
        step: 6,
        title: 'asB 生成草案 v2',
        description: `上调至 ¥${finalBenefit}（已达让利上限），附注：${draft2.note}`,
        data: { role: 'asB', draft: draft2, round: 2 },
      }, 600)

      const round2_draft: ContractRound = {
        round: 2,
        role: 'asB',
        type: 'draft',
        payload: { draft: draft2 },
        timestamp: Date.now(),
      }

      const c3 = getContract(contract.id)!
      updateContract(contract.id, {
        currentDraft: draft2,
        negotiationRounds: [...c3.negotiationRounds, round2_draft],
      })

      // asC accepts v2
      await emit(sceneId, {
        type: 'contract',
        step: 7,
        title: 'asC 接受草案 v2',
        description: `¥${finalBenefit} 在预期范围内，接受合约`,
        data: { role: 'asC', decision: 'accept', draft: draft2, rounds: 2 },
      }, 500)

      const round2_accept: ContractRound = {
        round: 2,
        role: 'asC',
        type: 'accept',
        payload: { accepted: true, finalBenefit },
        timestamp: Date.now(),
      }
      const c4 = getContract(contract.id)!
      updateContract(contract.id, {
        negotiationRounds: [...c4.negotiationRounds, round2_accept],
      })

      await executeContractStrike(sceneId, contract.id, userId, finalBenefit, 2, intent)
    }
  })

  // ─── Manual Mode Response Endpoint ──────────────────────────────────────────
  app.post<{
    Body: {
      contractId?: string
      action: 'accept' | 'counter' | 'reject'
      counterText?: string
    }
  }>('/api/scene/4/respond', async (req, reply) => {
    const { action, counterText } = req.body ?? {}
    if (!action) return reply.code(400).send({ ok: false, error: 'action required' })
    const emitter = manualEmitters.get('current')
    if (!emitter) return reply.code(404).send({ ok: false, error: 'No active manual session' })
    emitter.emit('decision', { action, counterText } satisfies ManualDecision)
    return { ok: true, action }
  })

  // ─── Pending scene 4 list ───────────────────────────────────────────────────
  app.get('/api/scene/4/pending', async (_req, reply) => ({
    pending: [...manualEmitters.keys()],
  }))
}
