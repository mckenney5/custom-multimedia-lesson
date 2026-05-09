const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('LocalStorageAdapter._set()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should save to localStorage with prefix', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      LocalStorageAdapter._set("testKey", "testValue");
      return localStorage.getItem("course_data_testKey");
    });
    expect(result).toBe("testValue");
  });

  test('should return true on success', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      return LocalStorageAdapter._set("key", "value");
    });
    expect(result).toBe(true);
  });

  test('should return false and log error on quota exceeded', async () => {
    const result = await page.evaluate(() => {
      const errors = [];
      const originalError = console.error;
      console.error = (msg) => errors.push(msg);
      
      LocalStorageAdapter.init();
      
      // Mock localStorage.setItem to throw
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
      
      const result = LocalStorageAdapter._set("key", "value");
      
      localStorage.setItem = originalSetItem;
      console.error = originalError;
      
      return {
        result: result,
        errorLogged: errors.length > 0
      };
    });
    expect(result.result).toBe(false);
    expect(result.errorLogged).toBe(true);
  });
});
