const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('public API properties', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should verify public API properties', async () => {
    const result = await page.evaluate(() => {
      const videoProgressIntervalOk = typeof journaler.videoProgressInterval === 'number' && !isNaN(journaler.videoProgressInterval);
      const initializedOk = typeof journaler.initialized === 'boolean';
      return videoProgressIntervalOk && initializedOk;
    });
    expect(result).toBe(true);
  });
});
