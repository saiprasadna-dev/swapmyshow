import { Hono } from 'hono'
import { logger } from './middleware/logger'
import { cors } from './middleware/cors'
import { errorHandler } from './middleware/errorHandler'
import type { AppBindings } from './types/bindings'
import { rootRoutes } from './routes/root'

const app = new Hono<{ Bindings: AppBindings }>()

app.onError(errorHandler)
app.use('*', logger)
app.use('*', cors)
app.route('/', rootRoutes)

export default app
