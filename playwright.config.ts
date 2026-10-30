import { defineConfig, devices } from '@playwright/test';

const ENV = { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key', VITE_TELEGRAM_BOT: 'lossmap_test_bot' };
export default defineConfig({
  testDir: 'e2e', timeout: 45_000, expect: { timeout: 8000 }, fullyParallel: true, workers: 2, retries: 0, reporter: [['list']],
  use: { baseURL: 'http://localhost:5199', permissions: ['camera', 'geolocation'], geolocation: { latitude: 13.5503, longitude: 78.5029 }, reducedMotion: 'reduce',
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } },
  projects: [{ name: 'mobile-360', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } }],
  webServer: [
    { command: 'npm -w web run dev -- --port 5199 --strictPort', port: 5199, reuseExistingServer: false, env: ENV, timeout: 60_000 },
    { command: 'npm -w web run build && npm -w web run preview -- --port 4174 --strictPort', port: 4174, reuseExistingServer: false, env: ENV, timeout: 120_000 },
  ],
});
