const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('init', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should initialize journaler correctly', async () => {
    const result = await page.evaluate(() => {
      // Reset journaler state
      journaler.initialized = false;
      journaler._startTime = null;
      journaler._eventBuffer = [];
      journaler._currentLog = [];
      journaler._userID = '';
      journaler._analyticsConfig = null;

      // Call init (will try to fetch analytics.json)
      return journaler.init().then(() => {
        // After init, these should be set
        return journaler.initialized === true &&
               typeof journaler._startTime === 'number' &&
               journaler._startTime > 0 &&
               Array.isArray(journaler._eventBuffer) &&
               Array.isArray(journaler._currentLog);
      });
    });

    expect(result).toBe(true);
  });
});
