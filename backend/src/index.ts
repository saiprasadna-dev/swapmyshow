import { Hono } from 'hono'
import { logger } from './middleware/logger'
import { cors } from './middleware/cors'
import { errorHandler } from './middleware/errorHandler'
import type { AppEnv } from './types/bindings'
import { rootRoutes } from './routes/root'
import { authRoutes } from './routes/auth'

const app = new Hono<AppEnv>()

app.onError(errorHandler)
app.use('*', logger)
app.use('*', cors)
app.route('/', rootRoutes)
app.route('/auth', authRoutes)

export default app
