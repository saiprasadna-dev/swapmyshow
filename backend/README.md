# SwapMyShow Backend

This directory contains the Cloudflare Workers backend for the SwapMyShow application.

## Overview

- Framework: Hono
- Runtime: Cloudflare Workers
- Language: TypeScript
- Deployment: Wrangler

## Project structure

- `src/` - application source files
- `src/routes/` - route definitions
- `src/controllers/` - controller handlers
- `src/middleware/` - global middleware
- `src/config/` - environment and runtime configuration
- `src/types/` - project-specific TypeScript types
- `dist/` - compiled output

## API endpoints

- `GET /` - health check endpoint returns API running message
- `GET /health` - service health response

## Local development

1. Install dependencies:
   ```sh
   cd backend
   npm install
   ```
2. Start Wrangler in local mode:
   ```sh
   npm run dev
   ```

## Build

```sh
npm run build
```
