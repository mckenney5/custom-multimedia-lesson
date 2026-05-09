const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('LocalStorageAdapter.setSessionTime()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should save session time in seconds', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      LocalStorageAdapter.setSessionTime(5000); // 5 seconds
      return localStorage.getItem("course_data_Session Time");
    });
    expect(result).toBe("5.00s");
  });

  test('should format milliseconds to 2 decimal places', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      LocalStorageAdapter.setSessionTime(1500); // 1.5 seconds
      return localStorage.getItem("course_data_Session Time");
    });
    expect(result).toBe("1.50s");
  });
});
