const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Timeout for each test */
  timeout: 30000,
  /* Test retries */
  retries: 0,
  /* Number of workers */
  workers: 4,
  /* Reporter to use */
  reporter: 'list',
  /* Shared settings for all the projects */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: 'http://localhost:8080/',
    /* retries is 0 in this config, so the "on-first-retry" modes would never
       fire; retain the artifacts of the failing run itself instead */
    trace: 'retain-on-failure',
    /* Retain video for failed tests */
    video: 'retain-on-failure',
  },
  /* Configure projects */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...require('@playwright/test').devices['Desktop Chrome'],
      },
    },
  ]
});