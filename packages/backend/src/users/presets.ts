import type { PresetUser } from '../coupon/types.js'

export const PRESET_USERS: PresetUser[] = [
  {
    id: 'alice',
    name: 'Alice',
    tier: '高价值',
    emoji: '💎',
    orderCount: 64,
    totalSpend: 8200,
    ltv: 92,
    businessTags: { 外卖: 4, 到餐: 2, 酒旅: 2, 闪购: 1 },
    preferences: ['日料', '精品咖啡'],
    activeTime: '工作日晚间',
    location: '望京SOHO附近',
  },
  {
    id: 'bob',
    name: 'Bob',
    tier: '新用户',
    emoji: '🆕',
    orderCount: 2,
    totalSpend: 136,
    ltv: 12,
    businessTags: { 外卖: 1 },
    preferences: ['快餐'],
    activeTime: '午间',
    location: '未知',
  },
  {
    id: 'carol',
    name: 'Carol',
    tier: '高频低客单',
    emoji: '⚡',
    orderCount: 203,
    totalSpend: 6100,
    ltv: 61,
    businessTags: { 外卖: 8, 医药: 2, 食杂零售: 2 },
    preferences: ['快餐', '便利'],
    activeTime: '全天',
    location: '朝阳区',
  },
  {
    id: 'david',
    name: 'David',
    tier: '多业务重度',
    emoji: '🏨',
    orderCount: 31,
    totalSpend: 15800,
    ltv: 88,
    businessTags: { 酒旅: 4, 到餐: 3, 服务零售: 2, 外卖: 1 },
    preferences: ['商务餐', '出差住宿'],
    activeTime: '出差高峰期',
    location: '全国出差',
  },
  {
    id: 'eva',
    name: 'Eva',
    tier: '成长型',
    emoji: '🌱',
    orderCount: 18,
    totalSpend: 2300,
    ltv: 55,
    businessTags: { 外卖: 3, 闪购: 2, 医药: 1 },
    preferences: ['健康轻食'],
    activeTime: '午间+晚间',
    location: '海淀区',
  },
]

export function getUser(id: string): PresetUser | undefined {
  return PRESET_USERS.find(u => u.id === id)
}

export function getAllUsers(): PresetUser[] {
  return PRESET_USERS
}
