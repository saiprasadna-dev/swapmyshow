import { Hono } from 'hono'
import { rootController } from '../controllers/rootController'
import { getConfig } from '../config/env'
import type { AppEnv } from '../types/bindings'

const app = new Hono<AppEnv>()

app.get('/', rootController.status)
app.get('/health', (c) => rootController.health(getConfig(c.env))(c))

export const rootRoutes = app
