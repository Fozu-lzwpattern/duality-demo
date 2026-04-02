import type { FastifyInstance, FastifyReply } from 'fastify'
import type { SceneEvent } from '../coupon/types.js'

// ─── SSE Client Registry ──────────────────────────────────────────────────────

type SSEClientId = string
type SceneId = string

const sseClients = new Map<SSeneClientKey, FastifyReply>()

type SSeneClientKey = `${SceneId}:${SSEClientId}`

export function registerSSEClient(sceneId: string, clientId: string, reply: FastifyReply): void {
  const key: SSeneClientKey = `${sceneId}:${clientId}`
  sseClients.set(key, reply)
}

export function unregisterSSEClient(sceneId: string, clientId: string): void {
  sseClients.delete(`${sceneId}:${clientId}`)
}

export function emitToScene(sceneId: string, event: SceneEvent): void {
  const prefix = `${sceneId}:`
  for (const [key, reply] of sseClients) {
    if (key.startsWith(prefix)) {
      const data = `data: ${JSON.stringify(event)}\n\n`
      try {
        reply.raw.write(data)
      } catch {
        // client disconnected
      }
    }
  }
}

export function emitToClient(sceneId: string, clientId: string, event: SceneEvent): void {
  const reply = sseClients.get(`${sceneId}:${clientId}`)
  if (reply) {
    try {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    } catch {
      // ignore
    }
  }
}

// ─── Route Registration ───────────────────────────────────────────────────────

export function registerSSERoutes(app: FastifyInstance): void {
  // GET /api/sse/scene/:sceneId?userId=alice
  app.get<{ Params: { sceneId: string }; Querystring: { userId?: string; clientId?: string } }>(
    '/api/sse/scene/:sceneId',
    async (request, reply) => {
      const { sceneId } = request.params
      const clientId = request.query.clientId ?? request.query.userId ?? `c_${Date.now()}`

      reply.raw.setHeader('Content-Type', 'text/event-stream')
      reply.raw.setHeader('Cache-Control', 'no-cache')
      reply.raw.setHeader('Connection', 'keep-alive')
      reply.raw.setHeader('X-Accel-Buffering', 'no')
      reply.raw.write(`:ok\n\n`)

      registerSSEClient(sceneId, clientId, reply)

      // Send welcome event
      const welcome: SceneEvent = {
        type: 'step',
        step: 0,
        title: `SSE Connected — Scene ${sceneId}`,
        description: `Client ${clientId} subscribed. POST /api/scene/${sceneId}/run to trigger.`,
        data: { sceneId, clientId },
        timestamp: Date.now(),
      }
      reply.raw.write(`data: ${JSON.stringify(welcome)}\n\n`)

      request.raw.on('close', () => {
        unregisterSSEClient(sceneId, clientId)
      })

      // Keep connection alive - return a never-ending promise
      await new Promise<void>((resolve) => {
        request.raw.on('close', resolve)
        request.raw.on('error', resolve)
      })
    }
  )
}
