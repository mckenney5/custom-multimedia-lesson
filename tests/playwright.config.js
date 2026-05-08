const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you have any failures */
  failOnLoadErrors: false,
  /* Timeout for each test */
  timeout: 30000,
  /* Test retries */
  retries: 0,
  /* Number of workers */
  workers: 1,
  /* Reporter to use */
  reporter: 'list',
  /* Shared settings for all the projects */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: 'http://localhost:8080/',
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    /* Additional wait for JavaScript initialization */
    video: 'on-first-retry',
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