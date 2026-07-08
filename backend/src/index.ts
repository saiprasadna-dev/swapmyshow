import { Hono } from 'hono'
import { logger } from './middleware/logger'
import { cors } from './middleware/cors'
import { errorHandler } from './middleware/errorHandler'
import type { AppEnv } from './types/bindings'
import { rootRoutes } from './routes/root'
import { authRoutes } from './routes/auth'
import { listingRoutes } from './routes/listings'
import { swapRoutes } from './routes/swaps'
import { meRoutes } from './routes/me'
import { uploadRoutes } from './routes/uploads'

const app = new Hono<AppEnv>()

app.onError(errorHandler)
app.use('*', logger)
app.use('*', cors)
app.route('/', rootRoutes)
app.route('/auth', authRoutes)
app.route('/listings', listingRoutes)
app.route('/swaps', swapRoutes)
app.route('/me', meRoutes)
app.route('/uploads', uploadRoutes)

export default app
