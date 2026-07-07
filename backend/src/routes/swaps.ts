import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { swapController } from '../controllers/swapController'
import { requireAuth } from '../middleware/auth'

// Every swap/chat endpoint requires a session.
const app = new Hono<AppEnv>()
app.use('*', requireAuth)

app.get('/:id', swapController.get)
app.get('/:id/messages', swapController.messages)
app.post('/:id/messages', swapController.send)
app.post('/:id/confirm', swapController.advance('confirm'))
app.post('/:id/transfer', swapController.advance('transfer'))
app.post('/:id/receipt', swapController.advance('receipt'))
app.post('/:id/rate', swapController.rate)

export const swapRoutes = app
