import type { Context } from 'hono'
import type { AppConfig } from '../config/env'

export const rootController = {
  status: (c: Context) => c.json({ message: 'SwapMyShow API Running' }),
  health: (config: AppConfig) => (c: Context) =>
    c.json({
      status: 'UP',
      service: 'SwapMyShow API',
      version: config.appVersion,
    }),
}
