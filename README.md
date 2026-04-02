# Duality Demo — AI Agent 与商业系统的双生融合

> 演示「人机协同」（Orchestrated）与「智能合约」（Contracted）两种模式在营销系统中的实际运行。
> 基于 4 个典型场景，从发一张优惠券出发，展示 AI Agent 与优惠券系统全链路协作。

---

## 快速开始

```bash
git clone <repo-url> duality-demo
cd duality-demo

# 安装后端依赖
npm --prefix packages/backend install --include=dev

# 启动后端（端口 3001）
npm run dev
```

> ⚠️ 注意：前端独立开发，访问 http://localhost:2026

---

## 接口验证

```bash
# 健康检查
curl http://localhost:3001/health

# 用户画像（5个预设）
curl http://localhost:3001/api/users

# 系统统计
curl http://localhost:3001/api/coupon/stats

# 场景1 SSE（先建立连接）
curl -N "http://localhost:3001/api/sse/scene/1?userId=alice"

# 另开终端触发场景1
curl -X POST http://localhost:3001/api/scene/1/run \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice","amount":50}'
```

---

## 四个演示场景

| 场景 | 模式 | 核心演示点 |
|------|------|-----------|
| **场景1：智能发券** | 人机协同 | Agent 请求 → ImpactGate 评估 LOW → 自动执行 → 审计链记录 |
| **场景2：危险操作** | 人机协同 | Agent 请求高危操作 → 触发红闸 → 人工审批 → 执行/撤销 |
| **场景3：跨系统 Saga** | 人机协同 | 发券+积分同步 → 积分服务失败 → Saga 补偿回滚 |
| **场景4：合约协商** | 智能合约 | asC 发出意图 → asB 评估画像 → 多轮协商 → 实时制券履约 |

### 场景4 两种模式

```bash
# autoAccept=true: asC 自动接受 v1 草案（1轮）
curl -X POST http://localhost:3001/api/scene/4/run \
  -d '{"userId":"alice","autoAccept":true}'

# autoAccept=false（默认）: 触发反询，2轮协商
curl -X POST http://localhost:3001/api/scene/4/run \
  -d '{"userId":"alice","autoAccept":false}'
```

---

## 技术栈

- **前端**: 独立工程，端口 2026（待接入）
- **后端**: Fastify + TypeScript，端口 3001
- **实时**: SSE 事件流（`GET /api/sse/scene/:sceneId`）
- **数据**: 内存存储（`POST /api/reset` 重置）
- **无数据库**: 重启即清空，适合 Demo 展示

---

## 主要 API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/users` | 5个预设用户画像 |
| GET | `/api/coupon/stats` | 系统统计 |
| GET | `/api/sse/scene/:id` | SSE 事件流 |
| POST | `/api/scene/:id/run` | 触发场景 1-4 |
| POST | `/api/scene/2/approve/:id` | 人工审批 |
| POST | `/api/coupon/templates` | 创建券模板 |
| POST | `/api/coupon/issue` | 发券 |
| POST | `/api/coupon/redeem` | 核销券 |
| POST | `/api/coupon/dynamic-mint` | 实时制券（场景4） |
| POST | `/api/reset` | 重置所有数据 |
| GET | `/api/audit` | 审计日志 |
| GET | `/api/contracts` | 合约列表 |
