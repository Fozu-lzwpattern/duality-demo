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
      // LTV 门槛：<20 为低信用，拒绝上调（REJECTED）；>=20 正常让利
      const LTV_THRESHOLD = 20
      const maxAllowed = Math.min(user.ltv * 0.4, 50)
      const rejected = user.ltv < LTV_THRESHOLD

      await emit(sceneId, {
        type: 'contract',
        step: 5,
        title: 'asB 重新评估让利空间',
        description: rejected
          ? `LTV ${user.ltv} < 阈值 ${LTV_THRESHOLD}，信用评分不足，拒绝上调让利`
          : `检查让利上限规则：maxAllowed = min(LTV×0.4, 50) = min(${user.ltv}×0.4, 50) = ${maxAllowed.toFixed(1)}`,
        data: {
          role: 'asB',
          ltv: user.ltv,
          ltvThreshold: LTV_THRESHOLD,
          formula: rejected ? `LTV(${user.ltv}) < 阈值(${LTV_THRESHOLD})` : `min(${user.ltv} × 0.4, 50)`,
          maxAllowed: rejected ? 0 : maxAllowed,
          requested: 36,
          canGrant: !rejected && maxAllowed >= 35,
          rejected,
        },
      })

      if (rejected) {
        // ─── REJECTED 路径 ───────────────────────────────────────────────────
        const round2_reject: ContractRound = {
          round: 2,
          role: 'asB',
          type: 'reject',
          payload: { reason: `LTV(${user.ltv}) 低于信用门槛(${LTV_THRESHOLD})，合约无法达成` },
          timestamp: Date.now(),
        }
        const cRej = getContract(contract.id)!
        updateContract(contract.id, {
          status: 'REJECTED',
          negotiationRounds: [...cRej.negotiationRounds, round2_reject],
        })

        await emit(sceneId, {
          type: 'contract',
          step: 6,
          title: '❌ asB 拒绝原始合约',
          description: `LTV ${user.ltv} < 门槛 ${LTV_THRESHOLD}，原始意图（¥30优惠）无法达成`,
          data: {
            role: 'asB',
            decision: 'reject',
            reason: `LTV(${user.ltv}) < 信用门槛(${LTV_THRESHOLD})`,
            contractStatus: 'REJECTED',
          },
        }, 600)

        addAudit({
          sceneId,
          userId,
          action: 'CONTRACT_REJECTED',
          payload: {
            contractId: contract.id,
            ltv: user.ltv,
            ltvThreshold: LTV_THRESHOLD,
            reason: 'LTV below credit threshold',
            intent,
          },
          operator: 'agent',
          result: 'rejected',
        })

        // ─── asB 主动发起反向提案：凑单升客单 ─────────────────────────────────
        await emit(sceneId, {
          type: 'contract',
          step: 7,
          title: 'asB 主动反向提案',
          description: '合约经济的关键：asB 不是终止者，而是寻路者——主动找到新的成交路径',
          data: {
            role: 'asB',
            action: 'counter_proposal',
            insight: '虽然信用评分不足，但 asB 识别到供给侧有"一人食至尊日料套餐"，客单价更高，系统毛利更优，可给予更大让利',
            proposal: {
              productName: '一人食至尊日料',
              description: '同店套餐，含刺身+热食+汤',
              originalPrice: 236,
              maxBenefit: 40,
              window: '今晚',
              note: '凑单提客单价，解锁更高优惠档位',
            },
          },
        }, 800)

        // asB 发出新草案
        const reproposedDraft = {
          productName: '一人食至尊日料',
          originalPrice: 236,
          discount: 0.83,
          maxBenefit: 40,
          window: '今晚 19:00-21:00',
          note: '凑单套餐，客单价升级，让利上限 ¥40',
        }

        const round3_reproposal: ContractRound = {
          round: 3,
          role: 'asB',
          type: 'draft',
          payload: {
            draft: reproposedDraft,
            counterProposal: true,
            reason: '主动寻路：升客单换更高让利',
          },
          timestamp: Date.now(),
        }

        // 创建新合约（原合约已 REJECTED，开新合约轮次）
        const contract2 = createContract(userId, `${intent}（套餐升级版）`)
        updateContract(contract2.id, {
          status: 'NEGOTIATING',
          currentDraft: reproposedDraft,
          negotiationRounds: [round3_reproposal],
        })

        await emit(sceneId, {
          type: 'contract',
          step: 8,
          title: 'asB 发出升级草案',
          description: `「一人食至尊日料，同店套餐，原价 ¥236，今晚，最高优惠 ¥40」`,
          data: {
            role: 'asB',
            contractId: contract2.id,
            draft: reproposedDraft,
            round: 3,
            isCounterProposal: true,
          },
        }, 700)

        // asC 评估新提案
        await emit(sceneId, {
          type: 'contract',
          step: 9,
          title: 'asC 评估升级提案',
          description: `asC 代 Bob 评估：¥236 - ¥40 = 实付 ¥196，人均低于原意图上限，且套餐更丰盛`,
          data: {
            role: 'asC',
            evaluation: {
              originalBudget: 150,
              proposedPrice: 236,
              discount: 40,
              finalPrice: 196,
              verdict: '实付¥196 > 原预算¥150，但套餐更具性价比',
              decision: 'accept',
              reasoning: '性价比优于原意图，asC 代用户接受升级提案',
            },
          },
        }, 900)

        const round3_accept: ContractRound = {
          round: 3,
          role: 'asC',
          type: 'accept',
          payload: { accepted: true, finalBenefit: 40, note: 'asC 代用户接受升级提案' },
          timestamp: Date.now(),
        }
        const c2upd = getContract(contract2.id)!
        updateContract(contract2.id, {
          negotiationRounds: [...c2upd.negotiationRounds, round3_accept],
        })

        // STRIKE 升级合约
        updateContract(contract2.id, { status: 'STRIKE' })
        await emit(sceneId, {
          type: 'contract',
          step: 10,
          title: '🤝 升级合约成交：STRIKE',
          description: `asB 寻路成功，双方就升级套餐达成协议，最终让利 ¥40`,
          data: {
            contractId: contract2.id,
            status: 'STRIKE',
            finalBenefit: 40,
            originalContractId: contract.id,
            originalStatus: 'REJECTED',
            narrative: 'asB 从"守门拒绝"到"主动寻路"——这就是合约经济与传统规则引擎的本质差异',
          },
        }, 600)

        // dynamicMint 升级券
        const coupon2 = createCoupon({
          templateId: `dynamic_upgrade_${contract2.id}`,
          userId,
          status: 'ACTIVE',
          businessType: '到餐',
          discountType: 'FIXED',
          discountValue: 40,
          minOrderAmount: 200,
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        })

        await emit(sceneId, {
          type: 'step',
          step: 11,
          title: '⚡ dynamicMint — 实时制券（升级版）',
          description: `按升级合约实时铸造：满¥200减¥40，仅限「一人食至尊日料」，今晚有效`,
          data: {
            couponId: coupon2.id,
            discountValue: 40,
            minOrderAmount: 200,
            productBound: '一人食至尊日料',
            validWindow: '4小时',
            minted: 'on-demand',
          },
        }, 700)

        const issuedCoupon2 = updateCoupon(coupon2.id, {
          status: 'ISSUED',
          issuedAt: new Date().toISOString(),
        })!

        updateContract(contract2.id, {
          status: 'FULFILLED',
          couponId: coupon2.id,
        })

        await emit(sceneId, {
          type: 'state_change',
          step: 12,
          title: '发券完成：issueByContract → ISSUED',
          description: `升级合约履约，券状态 ACTIVE → ISSUED，合约 → FULFILLED`,
          data: {
            couponId: issuedCoupon2.id,
            couponStatus: 'ISSUED',
            contractId: contract2.id,
            contractStatus: 'FULFILLED',
          },
        }, 500)

        const finalContract2 = getContract(contract2.id)!
        addAudit({
          sceneId,
          userId,
          action: 'CONTRACT_FULFILLED',
          payload: {
            contractId: contract2.id,
            originalContractId: contract.id,
            couponId: issuedCoupon2.id,
            finalBenefit: 40,
            rounds: 3,
            intent: `${intent}（asB升级提案）`,
            negotiationRounds: finalContract2.negotiationRounds,
            note: 'asB 主动寻路，从 REJECTED 反转为 FULFILLED',
          },
          operator: 'agent',
          result: 'success',
        })

        await emit(sceneId, {
          type: 'complete',
          step: 13,
          title: '场景4完成 ✅（完整合约经济演示）',
          description: `新用户信用不足 → asB 拒绝 → asB 主动寻路 → 升级合约 STRIKE → 实时制券 → 履约`,
          data: {
            originalContract: { id: contract.id, status: 'REJECTED', reason: `LTV ${user.ltv} < 门槛 ${LTV_THRESHOLD}` },
            upgradeContract: { id: contract2.id, status: 'FULFILLED', finalBenefit: 40 },
            couponId: issuedCoupon2.id,
            keyInsight: 'asB 不是规则守门员，而是有主体性的商业智能体——拒绝是手段，成交才是目标',
          },
        }, 400)
      } else {
        // ─── 正常 STRIKE 路径 ────────────────────────────────────────────────
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
