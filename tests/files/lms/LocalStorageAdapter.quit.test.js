const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('LocalStorageAdapter.quit()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should log session ended message', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      const logs = [];
      const originalLog = console.log;
      console.log = (msg) => logs.push(msg);
      
      LocalStorageAdapter.quit();
      
      console.log = originalLog;
      return logs.some(log => log.includes("[Local Storage] Session ended"));
    });
    expect(result).toBe(true);
  });

  test('should not throw error', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      try {
        LocalStorageAdapter.quit();
        return true;
      } catch(e) {
        return false;
      }
    });
    expect(result).toBe(true);
  });
});
