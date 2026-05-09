const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('LocalStorageAdapter.init()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should set initialized to true', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      return LocalStorageAdapter.initialized;
    });
    expect(result).toBe(true);
  });

  test('should be called by lms.init("standalone")', async () => {
    const result = await page.evaluate(() => {
      lms.init("standalone");
      return lms.driver.name === "Local Storage" && lms.initialized === true;
    });
    expect(result).toBe(true);
  });
});
