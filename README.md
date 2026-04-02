# Duality Demo — AI Agent 与商业系统的双生协作

> **一张优惠券背后，是整个 AI Agent 时代商业系统的范式演变**

这个 Demo 以"AI Agent 操作优惠券系统"为载体，验证 **Duality（双生）架构**的核心命题：
当 AI Agent 开始代替人类消费者（asC）和企业（asB）参与商业行为时，底层系统应该如何重新设计？

---

## 背景：为什么选优惠券？

优惠券是营销系统里最典型的"高风险 + 高频"操作场景：

- **高风险**：一条错误指令可以清空全部库存、错误发放亿级金额
- **高频**：Agent 每天可能触发数万次发券意图
- **多系统**：发券涉及库存、积分、支付、用户画像等多个下游系统
- **实时性**：用户正在下单，发券决策窗口只有几秒

这四个特征，使优惠券成为验证 **AI 治理架构** 是否成立的最佳沙盘。

---

## 核心命题：两种经济范式

```
计划经济模式（Orchestrated）         合约经济模式（Contracted）
─────────────────────────────        ──────────────────────────────
人类预设规则 → Agent 执行            asC 发出意图 → asB 实时制券
固定库存 → 按规发放                  供给由需求实时生成
系统告知 Agent 能做什么              Agent 与系统协商能做什么
ImpactGate 管控风险                  合约条款约束双方权利义务
```

Duality 的论点：**两种模式不是替代关系，而是共存、协同**。
现阶段的系统要同时支持两者，并能平滑过渡。

---

## 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│  Builder（建造者层）                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ 优惠券系统     │  │ 用户画像管理   │  │ Neural Interface        │ │
│  │ 18个核心接口   │  │ 5档用户分层    │  │ YAML Spec + 状态机图    │ │
│  │ 能力地图 + 规则│  │ LTV / 行为标签 │  │ 风险矩阵 + ARSP 协议    │ │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘ │
└─────────────────────────────┬────────────────────────────────────┘
                              │  YAML 能力说明书（Agent 的权限合同）
┌─────────────────────────────▼────────────────────────────────────┐
│  Runtime（运行时层）                                               │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌─────────────────────────────┐  │
│  │场景 1 │  │场景 2 │  │场景 3 │  │         场景 4              │  │
│  │智能发券│  │危险操作│  │Saga   │  │  合约协商（ARSP 协议）      │  │
│  └──────┘  └──────┘  │补偿   │  │  asC ←→ asB 实时协商        │  │
│                       └──────┘  └─────────────────────────────┘  │
│         ↑ SSE 实时事件流（`/api/sse/scene/:id`）                   │
└──────────────────────────────────────────────────────────────────┘
```

**三层分工：**
- **Builder**：定义系统有哪些能力、每个能力的风险等级、操作规则
- **Neural Interface**：生成 YAML 能力说明书（这是 Agent 看到的"合同"）
- **Runtime**：真实执行，ImpactGate 实时拦截，SSE 推送执行链路

---

## 快速启动

```bash
git clone https://github.com/Fozu-lzwpattern/duality-demo
cd duality-demo
./start.sh
```

浏览器访问：**http://localhost:2026**

> `start.sh` 会自动安装依赖、检查端口占用、并行启动前后端。

**手动启动：**
```bash
# 后端 (端口 3001)
cd packages/backend && npm install && npm run dev

# 前端 (端口 2026)
cd packages/frontend && npm install && npm run dev
```

---

## 四幕场景解读

### 🟢 场景 1：智能发券（ImpactGate 正常通行）

**核心命题**：AI Agent 操作系统，治理层能否正确放行低风险操作？

```
Agent 意图
  "给 Alice（高价值 VIP）发 50 元到餐券"
        ↓
   ImpactGate 评估
   风险: LOW | LTV: 312 | 金额: ¥50 < 阈值
        ↓
   自动批准 → 扣减库存 → 推送用户 → 写审计链
```

**验证点**：
- [ ] 用户画像（LTV/消费频次）影响风控决策
- [ ] LOW 风险自动通过，无需人工介入
- [ ] 完整审计链：谁发的、发给谁、什么时间、系统状态

---

### 🔴 场景 2：危险操作 + RED Gate（人工审批）

**核心命题**：当 AI Agent 触发高危操作时，系统能否强制介入人类？

```
Agent 指令
  "清空全部库存（bulk_expire_all）"
        ↓
   ImpactGate 评估
   风险: CRITICAL | scope: ALL | 影响 100% 有效券
        ↓
   RED Gate 触发 → 冻结操作 → 等待人工审批
        ↓
   人类决定：批准 / 拒绝
        ↓
   执行 or 安全撤销
```

**验证点**：
- [ ] CRITICAL 操作必须停下来等人
- [ ] 审批界面清楚展示风险详情（操作范围、影响范围）
- [ ] 人类拒绝后，系统安全回退，无副作用

---

### 🟡 场景 3：跨系统 Saga 补偿

**核心命题**：多系统协作失败时，AI 治理层能否保证数据一致性？

```
Agent 意图：发券 + 同步积分奖励
        ↓
   Step 1: 优惠券系统发券 ✅
   Step 2: 积分系统同步  ❌（模拟服务不可用）
        ↓
   Saga 引擎检测到失败
        ↓
   补偿：回滚券 → 通知用户失败 → 写补偿日志
```

**验证点**：
- [ ] 分布式事务不依赖数据库锁
- [ ] 每一步有明确的 undo 操作（补偿而非回滚）
- [ ] 最终一致性：用户不会拿到"半张券"

---

### 🔵 场景 4：合约协商（ARSP 协议 · 合约经济）

**核心命题**：asC（数字消费者）和 asB（营销系统）能否像两个商业主体一样协商？

```
asC（Alice 的数字分身）
  意图："我要在今晚 10 点前，吃一顿 ≤150 元的日料，给我最好的优惠"
        ↓ ARSP 协议
asB（营销 Agent）
  读取 Alice 画像：LTV 312 / 到餐 VIP / 近 30 天活跃
  生成 v1 草案合约：日料券 80 元，有效期今晚 24:00
        ↓
asC 反询
  "80 不够，我要 100"
        ↓
asB 重新评估
  Alice LTV 高，为留存值得让步 → 生成 v2：95 元券
        ↓
双方签约 → 实时制券 → 立即推送
```

**两种模式：**
- **Auto 模式**：asC 自动接受第一轮草案，1 轮协商完成
- **Manual 模式**：你扮演 asC，手动发出反询或接受/拒绝

**验证点**：
- [ ] 供给由需求实时生成（不是从库存取券）
- [ ] 协商过程可审计（每一轮提案都有记录）
- [ ] 合约双方地位对等（asC 可以拒绝）

---

## 关键设计决策

### ImpactGate 风险评估矩阵

| 风险等级 | 条件 | 处置 |
|----------|------|------|
| `LOW` | 金额 ≤ 阈值 AND 用户 LTV > 基准 | 自动通过 |
| `MEDIUM` | 金额超阈值 OR 批量 ≤ 50 | 增强日志，可自动通过 |
| `HIGH` | 批量 > 50 OR 跨系统写操作 | 需人工复核 |
| `CRITICAL` | scope=ALL OR 不可逆操作 | 强制人工审批，冻结执行 |

### ARSP 协议（Agent Runtime Service Protocol）

```
1. Intent Declaration  asC → asB: 声明意图、约束条件、用户画像
2. Capability Match    asB: 读取 Builder 生成的 YAML 能力说明书
3. Draft Contract      asB → asC: 生成草案（权益、限制、有效期）
4. Negotiation Loop    asC 可 Accept / Counter / Reject
5. Strike              双方签约，生成 contractId
6. Fulfillment         asB 实时制券，写履约记录
```

---

## 目录结构

```
duality-demo/
├── packages/
│   ├── backend/          # Fastify + TypeScript，端口 3001
│   │   └── src/
│   │       ├── coupon/       # 优惠券核心 CRUD 接口
│   │       ├── users/        # 用户画像接口
│   │       ├── runtime/      # SSE 事件系统 + ImpactGate
│   │       └── scenarios/    # 四幕场景实现
│   └── frontend/         # Vite + React + TypeScript，端口 2026
│       └── src/
│           ├── components/
│           │   ├── builder/  # Builder 层 3 个 Tab（券系统/用户/Neural Interface）
│           │   └── runtime/  # Runtime 层 4 幕场景
│           └── hooks/
│               ├── useSSE.ts    # SSE 事件订阅
│               └── useApi.ts    # API 请求 + 轮询
├── start.sh              # 一键启动脚本
└── README.md
```

---

## 主要 API

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/health` | 健康检查 |
| `GET` | `/api/users` | 5 个预设用户画像 |
| `GET` | `/api/coupon/stats` | 实时统计看板 |
| `GET` | `/api/sse/scene/:id` | SSE 实时事件流（先连接，再 run）|
| `POST` | `/api/scene/:id/run` | 触发场景 1-4 |
| `GET` | `/api/approvals` | 待审批列表 |
| `POST` | `/api/approvals/:id/decide` | 人工审批（approved: true/false）|
| `POST` | `/api/coupon/dynamic-mint` | 实时制券（场景 4）|
| `GET` | `/api/contracts` | 协商合约列表 |
| `GET` | `/api/audit` | 审计日志 |
| `POST` | `/api/reset` | 重置所有内存数据 |

---

## 技术栈

**后端**
- Fastify + TypeScript
- SSE（Server-Sent Events）实时推送
- 内存存储（无数据库，重启清空，适合 Demo）

**前端**
- React 18 + TypeScript + Vite 5
- Tailwind CSS v3（深色主题，`#0a0c12` 背景）
- ReactFlow 11（Neural Interface 状态机图）
- Framer Motion（场景动画）

---

## 关联设计理念

本 Demo 基于以下三个核心设计体系构建：

- **SuperSwitch Builder Spec** — Builder 层能力建模、YAML 规格生成、风险矩阵设计
- **Duality Architecture** — AI Agent 与商业系统双生融合的整体架构思想
- **Agentic Commerce** — asC（数字消费者）/ asB（数字企业）/ A2A 合约经济理论基础

---

*这个 Demo 不是一个完整产品，它是一套可以跑起来的设计语言验证器。*
*每一幕场景背后，都有一个在 AI Agent 时代必须回答的架构问题。*
