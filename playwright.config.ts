import { defineConfig } from '@playwright/test';

// Two production builds of the app:
//  - "open": personal/self-study mode (OPEN_ACCESS=true) with Postgres progress sync — walks the whole course.
//  - "locked": a production deployment whose Clerk keys are missing — must fail closed (paid weeks locked).
// Requires `npm run build` first and E2E_DATABASE_URL for the open project.
const db = process.env.E2E_DATABASE_URL ?? '';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'off', viewport: { width: 1280, height: 900 } },
  projects: [
    { name: 'open', testMatch: /open\.spec\.ts/, use: { baseURL: 'http://localhost:3100' } },
    { name: 'locked', testMatch: /locked\.spec\.ts/, use: { baseURL: 'http://localhost:3101' } },
  ],
  webServer: [
    {
      command: 'npx next start -p 3100',
      url: 'http://localhost:3100/api/health',
      env: { OPEN_ACCESS: 'true', DATABASE_URL: db, ANTHROPIC_API_KEY: '' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx next start -p 3101',
      url: 'http://localhost:3101/api/health',
      env: { OPEN_ACCESS: '', DATABASE_URL: '', CLERK_SECRET_KEY: '', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
