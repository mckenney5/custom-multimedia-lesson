const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('LocalStorageAdapter.setStatus()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should save status to localStorage', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      LocalStorageAdapter.setStatus("completed");
      return localStorage.getItem("course_data_status");
    });
    expect(result).toBe("completed");
  });

  test('should return true on success', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      return LocalStorageAdapter.setStatus("passed");
    });
    expect(result).toBe(true);
  });

  test('should log status setting', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      const logs = [];
      const originalLog = console.log;
      console.log = (msg) => logs.push(msg);
      
      LocalStorageAdapter.setStatus("failed");
      
      console.log = originalLog;
      return logs.some(log => log.includes("Setting Status"));
    });
    expect(result).toBe(true);
  });
});
