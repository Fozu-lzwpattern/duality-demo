import Fastify from 'fastify'
import cors from '@fastify/cors'
import { registerCouponRoutes } from './coupon/routes.js'
import { registerSSERoutes } from './runtime/events.js'
import { registerScene1Routes } from './scenarios/scene1.js'
import { registerScene2Routes } from './scenarios/scene2.js'
import { registerScene3Routes } from './scenarios/scene3.js'
import { registerScene4Routes } from './scenarios/scene4.js'
import { getAllUsers } from './users/presets.js'
import { getStats, resetAll, auditStore, contractStore } from './coupon/store.js'

const PORT = Number(process.env.PORT ?? 3001)

async function main() {
  const app = Fastify({ logger: true })

  // CORS
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })

  // ─── Health ──────────────────────────────────────────────────────────────────
  app.get('/health', async () => ({ ok: true, time: new Date().toISOString() }))

  // ─── Users ───────────────────────────────────────────────────────────────────
  app.get('/api/users', async () => ({ ok: true, data: getAllUsers() }))

  // ─── Audit log ───────────────────────────────────────────────────────────────
  app.get('/api/audit', async () => ({
    ok: true,
    data: [...auditStore].reverse().slice(0, 100),
  }))

  // ─── Contracts ───────────────────────────────────────────────────────────────
  app.get('/api/contracts', async () => ({
    ok: true,
    data: [...contractStore.values()],
  }))

  app.get<{ Params: { id: string } }>('/api/contracts/:id', async (req, reply) => {
    const c = contractStore.get(req.params.id)
    if (!c) return reply.code(404).send({ ok: false, error: 'Contract not found' })
    return { ok: true, data: c }
  })

  // ─── Reset ───────────────────────────────────────────────────────────────────
  app.post('/api/reset', async () => {
    resetAll()
    return { ok: true, message: 'All data reset' }
  })

  // ─── SSE Routes ──────────────────────────────────────────────────────────────
  registerSSERoutes(app)

  // ─── Coupon Routes ───────────────────────────────────────────────────────────
  registerCouponRoutes(app)

  // ─── Scene Routes ─────────────────────────────────────────────────────────────
  registerScene1Routes(app)
  registerScene2Routes(app)
  registerScene3Routes(app)
  registerScene4Routes(app)

  // ─── 404 fallback ────────────────────────────────────────────────────────────
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ ok: false, error: `Route not found: ${req.method} ${req.url}` })
  })

  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`\n✅ Duality backend running at http://localhost:${PORT}`)
  console.log(`   GET  /api/users`)
  console.log(`   GET  /api/coupon/stats`)
  console.log(`   GET  /api/sse/scene/:sceneId?userId=alice`)
  console.log(`   POST /api/scene/1/run ... /api/scene/4/run`)
  console.log(`   POST /api/reset\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
