import React, { useState, useCallback } from 'react'
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Edge,
  type Node,
  type Connection,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { BuilderStep, NeuralView, YamlTab } from '../../types'
import { RiskBadge } from '../ui/Badge'
import { Button } from '../ui/Button'

// ——— 静态 YAML 内容 ———
const YAML_CONTENTS = {
  semantic: `version: "1.0"
system:
  name: "美团优惠券平台"
  description: "管理优惠券的完整生命周期，支持计划经济发券和合约经济实时制券"
  
entities:
  - name: Coupon
    description: "优惠券实体，记录面值、状态、有效期等核心属性"
    fields:
      - name: id
        type: string
        description: "券唯一标识，UUIDv4 格式"
      - name: templateId
        type: string
        description: "所属模板 ID"
      - name: userId
        type: string
        description: "持有者用户 ID"
      - name: status
        type: enum
        values: [DRAFT, ACTIVE, ISSUED, REDEEMED, PAUSED, EXPIRED]
        description: "券当前状态"
      - name: faceValue
        type: integer
        description: "券面值（分）"
      - name: validFrom
        type: datetime
        description: "有效期起始"
      - name: validTo
        type: datetime
        description: "有效期截止"
      - name: metadata
        type: json
        description: "扩展字段，存储动态规则"
    
  - name: Contract
    description: "Agent 与用户之间的优惠合约"
    fields:
      - name: id
        type: string
        description: "合约唯一标识"
      - name: agentId
        type: string
        description: "发起方 Agent ID"
      - name: userId
        type: string
        description: "目标用户 ID"
      - name: offerType
        type: enum
        values: [DISCOUNT_PERCENTAGE, DISCOUNT_FIXED, CASHBACK, FREE_SHIPPING]
        description: "优惠类型"
      - name: offerValue
        type: integer
        description: "优惠数值（百分比或金额分）"
      - name: condition
        type: string
        description: "触发条件 DSL，如 \"orderValue >= 5000\""
      - name: lockedAmount
        type: integer
        description: "预授权锁定金额（分）"
      - name: status
        type: enum
        values: [PENDING, NEGOTIATING, STRIKE, FULFILLED, REJECTED, EXPIRED]
        description: "合约状态"`,

  statemachine: `version: "1.0"
state_machines:
  coupon_lifecycle:
    description: "优惠券状态机"
    initial_state: DRAFT
    states:
      - name: DRAFT
        description: "草稿状态，仅内部可见，尚未生效"
        capabilities: [read, update, delete]
      - name: ACTIVE
        description: "已生效，可被发放给目标用户"
        capabilities: [read, issue, pause]
      - name: ISSUED
        description: "已发放给用户，可被使用"
        capabilities: [read, verify, redeem, pause, expire]
      - name: REDEEMED
        description: "已核销完成，不可再次使用"
        capabilities: [read]
      - name: PAUSED
        description: "已暂停，暂时不可使用"
        capabilities: [read, resume, expire]
      - name: EXPIRED
        description: "已过期，不可使用"
        capabilities: [read]
    transitions:
      - { from: DRAFT, to: ACTIVE, trigger: publish, guard: "template.valid" }
      - { from: ACTIVE, to: ISSUED, trigger: issue, guard: "user.notInBlacklist && !quota.exceeded" }
      - { from: ISSUED, to: REDEEMED, trigger: redeem, guard: "order.eligible && !expired" }
      - { from: ACTIVE, to: PAUSED, trigger: pause }
      - { from: PAUSED, to: ACTIVE, trigger: resume }
      - { from: [ACTIVE, ISSUED, PAUSED], to: EXPIRED, trigger: expire }

  contract_lifecycle:
    description: "合约状态机"
    initial_state: PENDING
    states:
      - name: PENDING
        description: "合约提议已创建，等待用户响应"
      - name: NEGOTIATING
        description: "正在进行条款协商，Agent 可调整报价"
      - name: STRIKE
        description: "合约已达成，双方同意条款"
      - name: FULFILLED
        description: "合约已完成，优惠已兑现"
      - name: REJECTED
        description: "用户拒绝，合约终止"
      - name: EXPIRED
        description: "协商超时，合约自动失效"
    transitions:
      - { from: PENDING, to: NEGOTIATING, trigger: counter_offer }
      - { from: [PENDING, NEGOTIATING], to: STRIKE, trigger: accept, guard: "offer.meetsConstraints" }
      - { from: [PENDING, NEGOTIATING], to: REJECTED, trigger: reject }
      - { from: STRIKE, to: FULFILLED, trigger: fulfill, guard: "condition.satisfied" }
      - { from: [PENDING, NEGOTIATING], to: EXPIRED, trigger: timeout }`,

  aiprotocol: `version: "1.0"
ai_protocol:
  name: "coupon-agent-protocol"
  description: "AI Agent 访问优惠券系统的标准化协议"
  
  capabilities:
    - name: createCouponTemplate
      description: "创建新优惠券模板，定义面值、有效期、适用范围"
      risk_level: MEDIUM
      required_permissions: [coupon.write]
      trigger_gate: "requires_approval"
      parameters:
        - faceValue: "整数，单位分，最大 10000"
        - validDays: "整数，默认 7"
        - applicableCategories: "字符串数组"
    
    - name: issueToUser
      description: "向指定用户发放优惠券"
      risk_level: HIGH
      required_permissions: [coupon.write, user.read]
      trigger_gate: "requires_approval"
      guard_conditions:
        - "!user.inBlacklist"
        - "!quota.dailyExceeded"
        - "activity.active && !activity.expired"
    
    - name: dynamicMint
      description: "根据用户 LTV 实时计算让利上限并制券"
      risk_level: CRITICAL
      required_permissions: [coupon.write, user.read, analytics.read]
      trigger_gate: "requires_human_approval"
      constraints:
        - "user.ltv >= 80"
        - "maxDiscount = min(user.ltv * 0.4, 5000)"
      
    - name: redeem
      description: "核销优惠券完成消费抵扣"
      risk_level: HIGH
      required_permissions: [coupon.write, order.read]
      trigger_gate: "auto_execute"
      idempotency_key: "orderId"
    
    - name: negotiateContract
      description: "与用户协商优惠合约条款"
      risk_level: HIGH
      required_permissions: [contract.write, user.read]
      trigger_gate: "requires_approval"
      max_rounds: 3
      approval_threshold: "offerChange > 20%"
    
    - name: fulfillContract
      description: "完成合约清算，确认资金转移"
      risk_level: CRITICAL
      required_permissions: [contract.write, payment.write]
      trigger_gate: "requires_human_approval"
      audit_required: true
    
    - name: getCoupon
      description: "查询优惠券详情"
      risk_level: LOW
      required_permissions: [coupon.read]
      trigger_gate: "auto_execute"
    
    - name: listByUser
      description: "查询用户持有券列表"
      risk_level: LOW
      required_permissions: [coupon.read, user.read]
      trigger_gate: "auto_execute"
      rate_limit: "100/min"
    
    - name: pause
      description: "暂停优惠券使用"
      risk_level: MEDIUM
      required_permissions: [coupon.write]
      trigger_gate: "requires_approval"
      reversible: true
      
    - name: refund
      description: "执行退款退券，释放预授权"
      risk_level: HIGH
      required_permissions: [coupon.write, payment.write]
      trigger_gate: "requires_approval"
      guard_conditions:
        - "order.refundEligible"
        - "coupon.status == 'REDEEMED' || coupon.status == 'ISSUED'"`,
}

// ——— ReactFlow 样式 ———
const nodeStyleObj = {
  background: '#1a2332',
  border: '1px solid #20c4cb66',
  color: '#e2e8f0',
  fontFamily: 'monospace',
  fontSize: '11px',
  borderRadius: '8px',
  padding: '8px 12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
}

const edgeStyleObj = { stroke: '#20c4cb99', strokeWidth: 2 }

// ——— ReactFlow 状态机数据 ———
const COUPON_NODES: Node[] = [
  { id: 'DRAFT', type: 'default', position: { x: 50, y: 50 }, data: { label: 'DRAFT\n草稿' }, style: nodeStyleObj },
  { id: 'ACTIVE', type: 'default', position: { x: 250, y: 50 }, data: { label: 'ACTIVE\n生效' }, style: nodeStyleObj },
  { id: 'ISSUED', type: 'default', position: { x: 450, y: 50 }, data: { label: 'ISSUED\n已发' }, style: nodeStyleObj },
  { id: 'REDEEMED', type: 'default', position: { x: 650, y: 50 }, data: { label: 'REDEEMED\n已核销' }, style: nodeStyleObj },
  { id: 'PAUSED', type: 'default', position: { x: 350, y: 150 }, data: { label: 'PAUSED\n暂停' }, style: nodeStyleObj },
  { id: 'EXPIRED', type: 'default', position: { x: 550, y: 150 }, data: { label: 'EXPIRED\n过期' }, style: nodeStyleObj },
]

const COUPON_EDGES: Edge[] = [
  { id: 'e1', source: 'DRAFT', target: 'ACTIVE', label: 'publish', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#20c4cb' } },
  { id: 'e2', source: 'ACTIVE', target: 'ISSUED', label: 'issue', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#20c4cb' } },
  { id: 'e3', source: 'ISSUED', target: 'REDEEMED', label: 'redeem', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#20c4cb' } },
  { id: 'e4', source: 'ACTIVE', target: 'PAUSED', label: 'pause', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#20c4cb' } },
  { id: 'e5', source: 'PAUSED', target: 'ACTIVE', label: 'resume', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#20c4cb' } },
  { id: 'e6', source: 'ACTIVE', target: 'EXPIRED', label: 'expire', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#f472b6' } },
  { id: 'e7', source: 'ISSUED', target: 'EXPIRED', label: 'expire', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#f472b6' } },
  { id: 'e8', source: 'PAUSED', target: 'EXPIRED', label: 'expire', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#f472b6' } },
]

const CONTRACT_NODES: Node[] = [
  { id: 'PENDING', type: 'default', position: { x: 50, y: 50 }, data: { label: 'PENDING\n待响应' }, style: nodeStyleObj },
  { id: 'NEGOTIATING', type: 'default', position: { x: 250, y: 50 }, data: { label: 'NEGOTIATING\n协商中' }, style: nodeStyleObj },
  { id: 'STRIKE', type: 'default', position: { x: 450, y: 50 }, data: { label: 'STRIKE\n已达成' }, style: nodeStyleObj },
  { id: 'FULFILLED', type: 'default', position: { x: 450, y: 150 }, data: { label: 'FULFILLED\n已清算' }, style: nodeStyleObj },
  { id: 'REJECTED', type: 'default', position: { x: 250, y: 150 }, data: { label: 'REJECTED\n已拒绝' }, style: nodeStyleObj },
  { id: 'EXPIRED', type: 'default', position: { x: 50, y: 150 }, data: { label: 'EXPIRED\n已超时' }, style: nodeStyleObj },
]

const CONTRACT_EDGES: Edge[] = [
  { id: 'c1', source: 'PENDING', target: 'NEGOTIATING', label: 'counter', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8' } },
  { id: 'c2', source: 'NEGOTIATING', target: 'STRIKE', label: 'accept', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#20c4cb' } },
  { id: 'c3', source: 'PENDING', target: 'STRIKE', label: 'accept', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#20c4cb' } },
  { id: 'c4', source: 'PENDING', target: 'REJECTED', label: 'reject', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#f472b6' } },
  { id: 'c5', source: 'NEGOTIATING', target: 'REJECTED', label: 'reject', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#f472b6' } },
  { id: 'c6', source: 'STRIKE', target: 'FULFILLED', label: 'fulfill', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#20c4cb' } },
  { id: 'c7', source: 'PENDING', target: 'EXPIRED', label: 'timeout', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#f472b6' } },
  { id: 'c8', source: 'NEGOTIATING', target: 'EXPIRED', label: 'timeout', style: edgeStyleObj, markerEnd: { type: MarkerType.ArrowClosed, color: '#f472b6' } },
]

// ——— Builder 动画组件 ———
const BuilderProgress: React.FC<{
  step: BuilderStep
  onRun: () => void
}> = ({ step, onRun }) => {
  const isDone = step === 'done'
  const isRunning = step !== 'idle' && step !== 'done'

  const stepInfo: Record<BuilderStep, { label: string; desc: string; progress: number }> = {
    idle: { label: '等待开始', desc: '', progress: 0 },
    scanning: { label: 'Step 1 扫描 coupon-simulator OpenAPI...', desc: '发现 18 个接口，6 个实体，23 条业务规则', progress: 40 },
    semantic: { label: 'Step 2 提取语义层（semantic.yaml）...', desc: '✓ 语义层提取完成', progress: 60 },
    statemachine: { label: 'Step 3 构建状态机（state-machine.yaml）...', desc: '✓ 状态机构建完成', progress: 80 },
    protocol: { label: 'Step 4 生成 AI 协议（ai-protocol.yaml）...', desc: '✓ AI 协议生成完成', progress: 95 },
    done: { label: '✓ Neural Interface 已就绪', desc: '系统可被 AI 驾驶', progress: 100 },
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <span className="font-semibold text-text-primary">Builder</span>
        </div>
        {isDone ? (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            Neural Interface 就绪
          </div>
        ) : (
          <Button onClick={onRun} disabled={isRunning}>
            {isRunning ? '⏳ 运行中...' : '🔄 运行 Builder'}
          </Button>
        )}
      </div>

      {/* Progress bars */}
      <div className="space-y-3">
        {(['scanning', 'semantic', 'statemachine', 'protocol'] as BuilderStep[]).map((s, idx) => {
          const active = step === s
          const completed = ['done', 'protocol', 'statemachine', 'semantic'].includes(step) && s !== 'protocol' && s !== 'statemachine' && s !== 'semantic' ? false : step === 'done' || ['protocol', 'statemachine', 'semantic'].indexOf(step) > ['scanning', 'semantic', 'statemachine'].indexOf(s)
          const stepLabels = [
            'Step 1 扫描 coupon-simulator OpenAPI...',
            'Step 2 提取语义层（semantic.yaml）...',
            'Step 3 构建状态机（state-machine.yaml）...',
            'Step 4 生成 AI 协议（ai-protocol.yaml）...',
          ]
          const stepDescs = [
            '发现 18 个接口，6 个实体，23 条业务规则',
            '定义 Coupon、Contract 等核心实体语义',
            '构建状态转换图，标注 Guard 条件',
            '封装能力列表，标注风险等级与触发门控',
          ]
          return (
            <div key={s} className={`text-sm ${completed || active ? 'text-text-primary' : 'text-text-secondary/50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span>{completed ? '✓' : active ? '→' : '○'}</span>
                <span className={active ? 'text-accent' : ''}>{stepLabels[idx]}</span>
              </div>
              {(active || completed) && (
                <div className="ml-5">
                  <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${completed ? 'bg-green-500' : 'bg-accent'}`}
                      style={{ width: completed ? '100%' : active ? '80%' : '0%' }}
                    />
                  </div>
                  {active && (
                    <p className="text-xs text-text-secondary mt-1">→ {stepDescs[idx]}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {isDone && (
        <div className="mt-4 pt-4 border-t border-border text-center text-green-400 text-sm">
          ✓ Neural Interface 已就绪，系统可被 AI 驾驶
        </div>
      )}
    </div>
  )
}

// ——— Graph 视图 ———
const GraphView: React.FC = () => {
  const [nodes1, setNodes1, onNodesChange1] = useNodesState(COUPON_NODES)
  const [edges1, setEdges1, onEdgesChange1] = useEdgesState(COUPON_EDGES)
  const [nodes2, setNodes2, onNodesChange2] = useNodesState(CONTRACT_NODES)
  const [edges2, setEdges2, onEdgesChange2] = useEdgesState(CONTRACT_EDGES)

  const onConnect1 = useCallback((params: Connection) => setEdges1(eds => addEdge(params, eds)), [setEdges1])
  const onConnect2 = useCallback((params: Connection) => setEdges2(eds => addEdge(params, eds)), [setEdges2])

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2 border-b border-border text-xs text-text-secondary font-mono">优惠券状态机</div>
        <div className="h-[280px]">
          <ReactFlow
            nodes={nodes1}
            edges={edges1}
            onNodesChange={onNodesChange1}
            onEdgesChange={onEdgesChange1}
            onConnect={onConnect1}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
          >
            <Background color="#2a2d3e" gap={20} size={1} />
            <Controls className="!bg-surface !border-border" />
          </ReactFlow>
        </div>
      </div>
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2 border-b border-border text-xs text-text-secondary font-mono">合约状态机</div>
        <div className="h-[280px]">
          <ReactFlow
            nodes={nodes2}
            edges={edges2}
            onNodesChange={onNodesChange2}
            onEdgesChange={onEdgesChange2}
            onConnect={onConnect2}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
          >
            <Background color="#2a2d3e" gap={20} size={1} />
            <Controls className="!bg-surface !border-border" />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}

// ——— YAML 视图 ———
const YamlView: React.FC = () => {
  const [tab, setTab] = useState<YamlTab>('semantic')
  const content = YAML_CONTENTS[tab]

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden flex flex-col h-[600px]">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {[
          { id: 'semantic', label: 'semantic.yaml', icon: '📝' },
          { id: 'statemachine', label: 'state-machine.yaml', icon: '🔀' },
          { id: 'aiprotocol', label: 'ai-protocol.yaml', icon: '🤖' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as YamlTab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm border-r border-border transition-colors ${
              tab === t.id ? 'bg-bg text-accent' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      {/* Code */}
      <div className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language="yaml"
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1.5rem',
            background: 'transparent',
            fontSize: '12px',
            lineHeight: '1.6',
          }}
          showLineNumbers
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

// ——— 解读视图 ———
const InsightView: React.FC = () => {
  const [subTab, setSubTab] = useState<'semantic' | 'statemachine' | 'aiprotocol'>('semantic')

  const entities = [
    {
      name: 'Coupon',
      desc: '优惠券实体，记录面值、状态、有效期等核心属性',
      fields: [
        { name: 'id', type: 'string', desc: 'UUIDv4 唯一标识' },
        { name: 'templateId', type: 'string', desc: '所属模板 ID' },
        { name: 'userId', type: 'string', desc: '持有者用户 ID' },
        { name: 'status', type: 'enum[6]', desc: '券状态：DRAFT/ACTIVE/ISSUED/REDEEMED/PAUSED/EXPIRED' },
        { name: 'faceValue', type: 'integer', desc: '面值（分）' },
        { name: 'validFrom/validTo', type: 'datetime', desc: '有效期起止' },
        { name: 'metadata', type: 'json', desc: '扩展动态规则' },
      ],
    },
    {
      name: 'Contract',
      desc: 'Agent 与用户之间的优惠合约',
      fields: [
        { name: 'id', type: 'string', desc: '合约唯一标识' },
        { name: 'agentId', type: 'string', desc: '发起方 Agent ID' },
        { name: 'userId', type: 'string', desc: '目标用户 ID' },
        { name: 'offerType', type: 'enum[4]', desc: '折扣类型' },
        { name: 'offerValue', type: 'integer', desc: '折扣数值' },
        { name: 'condition', type: 'string', desc: '触发条件 DSL' },
        { name: 'lockedAmount', type: 'integer', desc: '预授权锁定金额' },
        { name: 'status', type: 'enum[6]', desc: '合约状态' },
      ],
    },
  ]

  const stateTransitions = [
    { from: 'DRAFT', to: 'ACTIVE', trigger: 'publish', guard: 'template.valid' },
    { from: 'ACTIVE', to: 'ISSUED', trigger: 'issue', guard: '黑名单检查 && 频次检查' },
    { from: 'ISSUED', to: 'REDEEMED', trigger: 'redeem', guard: '订单满足条件 && 未过期' },
    { from: 'PENDING', to: 'STRIKE', trigger: 'accept', guard: 'offer.meetsConstraints' },
    { from: 'STRIKE', to: 'FULFILLED', trigger: 'fulfill', guard: 'condition.satisfied' },
  ]

  const capabilities = [
    { name: 'createCouponTemplate', risk: 'MEDIUM' as const, perm: 'coupon.write', gate: 'requires_approval' },
    { name: 'issueToUser', risk: 'HIGH' as const, perm: 'coupon.write', gate: 'requires_approval' },
    { name: 'dynamicMint', risk: 'CRITICAL' as const, perm: 'coupon.write + analytics', gate: 'requires_human_approval' },
    { name: 'redeem', risk: 'HIGH' as const, perm: 'coupon.write', gate: 'auto_execute' },
    { name: 'negotiateContract', risk: 'HIGH' as const, perm: 'contract.write', gate: 'requires_approval' },
    { name: 'fulfillContract', risk: 'CRITICAL' as const, perm: 'payment.write', gate: 'requires_human_approval' },
    { name: 'getCoupon / listByUser', risk: 'LOW' as const, perm: 'coupon.read', gate: 'auto_execute' },
  ]

  return (
    <div className="space-y-4">
      {/* Sub tabs */}
      <div className="flex gap-2">
        {[
          { id: 'semantic', label: '语义解读', icon: '📝' },
          { id: 'statemachine', label: '状态机解读', icon: '🔀' },
          { id: 'aiprotocol', label: '协议解读', icon: '🤖' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as typeof subTab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              subTab === t.id
                ? 'bg-accent/20 text-accent border border-accent/40'
                : 'text-text-secondary hover:text-text-primary bg-surface border border-border'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Semantic */}
      {subTab === 'semantic' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entities.map(e => (
            <div key={e.name} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-accent font-mono text-sm font-bold">{e.name}</span>
                <span className="text-xs text-text-secondary">— {e.desc}</span>
              </div>
              <div className="space-y-1">
                {e.fields.map(f => (
                  <div key={f.name} className="flex items-start gap-2 text-xs">
                    <code className="text-green-400 font-mono min-w-[100px]">{f.name}</code>
                    <code className="text-accent/70 font-mono min-w-[80px]">{f.type}</code>
                    <span className="text-text-secondary">{f.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* State Machine */}
      {subTab === 'statemachine' && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-xs text-text-secondary font-mono mb-3">关键状态转换与 Guard 条件</div>
          <div className="space-y-2">
            {stateTransitions.map((t, i) => (
              <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-bg/50">
                <code className="text-accent font-mono bg-accent/10 px-2 py-0.5 rounded">{t.from}</code>
                <span className="text-text-secondary">→</span>
                <code className="text-green-400 font-mono bg-green-400/10 px-2 py-0.5 rounded">{t.to}</code>
                <span className="text-text-secondary text-xs">trigger:</span>
                <code className="text-yellow-400 font-mono text-xs">{t.trigger}</code>
                <span className="text-text-secondary text-xs">guard:</span>
                <code className="text-purple-400 font-mono text-xs">{t.guard}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Protocol */}
      {subTab === 'aiprotocol' && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="text-xs text-text-secondary font-mono px-4 py-2 border-b border-border">能力矩阵 — 风险等级与门控策略</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg text-text-secondary text-xs">
                <th className="text-left px-4 py-2 font-medium">能力</th>
                <th className="text-left px-4 py-2 font-medium">风险等级</th>
                <th className="text-left px-4 py-2 font-medium">需要权限</th>
                <th className="text-left px-4 py-2 font-medium">触发 Gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {capabilities.map(c => (
                <tr key={c.name} className="hover:bg-bg/50">
                  <td className="px-4 py-2.5"><code className="text-accent font-mono text-xs">{c.name}</code></td>
                  <td className="px-4 py-2.5"><RiskBadge level={c.risk} /></td>
                  <td className="px-4 py-2.5 text-text-secondary text-xs">{c.perm}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={`${c.gate.includes('human') ? 'text-red-400' : c.gate.includes('approval') ? 'text-yellow-400' : 'text-green-400'}`}>
                      {c.gate}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ——— 主组件 ———
const NeuralInterface: React.FC = () => {
  const [builderStep, setBuilderStep] = useState<BuilderStep>('idle')
  const [view, setView] = useState<NeuralView>('graph')

  const runBuilder = () => {
    if (builderStep !== 'idle' && builderStep !== 'done') return
    setBuilderStep('scanning')
    setTimeout(() => setBuilderStep('semantic'), 1500)
    setTimeout(() => setBuilderStep('statemachine'), 2500)
    setTimeout(() => setBuilderStep('protocol'), 4000)
    setTimeout(() => setBuilderStep('done'), 5500)
  }

  return (
    <div className="flex flex-col gap-5 p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🧠</span>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Neural Interface</h2>
          <p className="text-xs text-text-secondary">AI 协议生成 · 状态机可视化 · 语义层解读</p>
        </div>
      </div>

      {/* Builder Progress */}
      <BuilderProgress step={builderStep} onRun={runBuilder} />

      {/* View Switcher */}
      {builderStep === 'done' && (
        <>
          <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1 w-fit">
            {([
              { id: 'graph', label: 'Graph 视图', icon: '🕸️' },
              { id: 'yaml', label: 'YAML 视图', icon: '📄' },
              { id: 'insight', label: '解读视图', icon: '💡' },
            ] as { id: NeuralView; label: string; icon: string }[]).map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                  view === v.id
                    ? 'bg-accent text-bg font-medium'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>{v.icon}</span>
                <span>{v.label}</span>
              </button>
            ))}
          </div>

          {/* View Content */}
          {view === 'graph' && <GraphView />}
          {view === 'yaml' && <YamlView />}
          {view === 'insight' && <InsightView />}
        </>
      )}

      {builderStep !== 'done' && (
        <div className="flex-1 flex items-center justify-center text-text-secondary">
          <div className="text-center">
            <div className="text-4xl mb-3 opacity-50">🧠</div>
            <p className="text-sm">运行 Builder 生成 Neural Interface 后可查看详细内容</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default NeuralInterface
