import type { AppBindings } from '../types/bindings'

export type AppConfig = {
  appVersion: string
  nodeEnv: string
}

export const getConfig = (env: AppBindings): AppConfig => ({
  appVersion: env.APP_VERSION ?? '1.0.0',
  nodeEnv: env.NODE_ENV ?? 'development',
})
