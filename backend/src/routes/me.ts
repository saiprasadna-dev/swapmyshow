import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { listingController } from '../controllers/listingController'
import { swapController } from '../controllers/swapController'
import { requireAuth } from '../middleware/auth'

// The caller's own listings and swaps (Profile tabs). All require a session.
const app = new Hono<AppEnv>()
app.use('*', requireAuth)

app.get('/listings', listingController.mine)
app.get('/saved', listingController.saved)
app.get('/swaps', swapController.mine)
app.get('/conversations', swapController.conversations)

export const meRoutes = app
