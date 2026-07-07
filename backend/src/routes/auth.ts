import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authController } from '../controllers/authController'
import { requireAuth } from '../middleware/auth'

const app = new Hono<AppEnv>()

// Exchange a Google ID token for a SwapMyShow session token.
app.post('/google', authController.google)

// Sign-up: request an email code, then verify it (with the profile + password)
// to create the account. After that, sign in with email + password below.
app.post('/otp/request', authController.requestOtp)
app.post('/otp/verify', authController.verifyOtp)

// Email + password sign-in (no OTP).
app.post('/login', authController.login)

// Forgot password: email a reset code, then set a new password with it.
app.post('/password/forgot', authController.forgotPassword)
app.post('/password/reset', authController.resetPassword)

// Attach a phone number to the signed-in account (one-time).
app.post('/phone', requireAuth, authController.setPhone)

// Return the currently authenticated user.
app.get('/me', requireAuth, authController.me)

export const authRoutes = app
