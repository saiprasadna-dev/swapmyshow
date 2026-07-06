import { Hono } from 'hono'
import { rootController } from '../controllers/rootController'
import { getConfig } from '../config/env'
import type { AppBindings } from '../types/bindings'

const app = new Hono<{ Bindings: AppBindings }>()

app.get('/', rootController.status)
app.get('/health', (c) => rootController.health(getConfig(c.env))(c))

export const rootRoutes = app
