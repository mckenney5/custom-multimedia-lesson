const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('LocalStorageAdapter._log()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should log with [Local Storage] prefix', async () => {
    const result = await page.evaluate(() => {
      const logs = [];
      const originalLog = console.log;
      console.log = (msg) => logs.push(msg);
      
      LocalStorageAdapter._log("Test message");
      
      console.log = originalLog;
      
      return {
        logged: logs.length > 0,
        hasPrefix: logs[0] ? logs[0].includes("[Local Storage]") : false,
        hasMessage: logs[0] ? logs[0].includes("Test message") : false
      };
    });
    expect(result.logged).toBe(true);
    expect(result.hasPrefix).toBe(true);
    expect(result.hasMessage).toBe(true);
  });
});
