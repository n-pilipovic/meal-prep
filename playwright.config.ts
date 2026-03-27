import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4200',
    // Default: headed when running locally (override with --headed / --headless CLI flag)
    headless: false,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'iphone14',
      use: {
        ...devices['iPhone 14'],
      },
    },
    {
      name: 'iphone13mini',
      use: {
        ...devices['iPhone 13 Mini'],
      },
    },
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 720 },
        isMobile: false,
      },
    },
  ],
  webServer: {
    command: 'npx ng serve --port 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
