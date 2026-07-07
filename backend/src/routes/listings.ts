import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { listingController } from '../controllers/listingController'
import { swapController } from '../controllers/swapController'
import { requireAuth } from '../middleware/auth'

const app = new Hono<AppEnv>()

// Public browse + detail.
app.get('/', listingController.list)
app.get('/:id', listingController.get)

// Authenticated: create a listing, start a swap on one.
app.post('/', requireAuth, listingController.create)
app.post('/:id/swap', requireAuth, swapController.start)
app.post('/:id/save', requireAuth, listingController.toggleSave)

export const listingRoutes = app
