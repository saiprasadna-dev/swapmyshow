import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authController } from '../controllers/authController'
import { requireAuth } from '../middleware/auth'

const app = new Hono<AppEnv>()

// Exchange a Google ID token for a SwapMyShow session token.
app.post('/google', authController.google)

// Passwordless email sign-in: request a code, then verify it for a session.
app.post('/otp/request', authController.requestOtp)
app.post('/otp/verify', authController.verifyOtp)

// Attach a phone number to the signed-in account (one-time).
app.post('/phone', requireAuth, authController.setPhone)

// Return the currently authenticated user.
app.get('/me', requireAuth, authController.me)

export const authRoutes = app
