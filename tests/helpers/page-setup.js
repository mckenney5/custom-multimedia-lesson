const { expect } = require('@playwright/test');

/**
 * Sets up a Playwright page for journaler.js testing.
 * Navigates to the test server and waits for journaler to be available.
 * @param {import('@playwright/test').Page} page - Playwright page instance
 * @returns {Promise<import('@playwright/test').Page>}
 */
async function setupPage(page) {
  await page.goto('http://localhost:8080');
  await page.waitForFunction(() => typeof journaler !== 'undefined');
  return page;
}

module.exports = { setupPage };
