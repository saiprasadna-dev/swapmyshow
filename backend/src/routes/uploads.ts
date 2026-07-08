import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { uploadController } from '../controllers/uploadController'
import { requireAuth } from '../middleware/auth'

const app = new Hono<AppEnv>()

// Uploading requires a session; serving an image is public so it can render.
app.post('/', requireAuth, uploadController.create)
app.get('/:key', uploadController.get)

export const uploadRoutes = app
