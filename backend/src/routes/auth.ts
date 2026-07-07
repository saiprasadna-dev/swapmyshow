import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authController } from '../controllers/authController'
import { requireAuth } from '../middleware/auth'

const app = new Hono<AppEnv>()

// Exchange a Google ID token for a SwapMyShow session token.
app.post('/google', authController.google)

// Return the currently authenticated user.
app.get('/me', requireAuth, authController.me)

export const authRoutes = app
