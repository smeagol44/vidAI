import {defineConfig} from '@playwright/test';
import base from './playwright.config';

// Focused regression for the user's Firefox runtime. Keep the ordinary
// Chromium gate and use its existing server/startup/command assertions.
export default defineConfig({
  ...base,
  testMatch: ['performance-worker.spec.ts', 'side-windows.spec.ts'],
  use: {...base.use, browserName: 'firefox', launchOptions: {}},
});
