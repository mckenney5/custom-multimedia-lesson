const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter._dataOverLimit()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should return false when data is under limit', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._dataOverLimit("small data", 4095);
    });
    expect(result).toBe(false);
  });

  test('should return true when data exceeds limit', async () => {
    const result = await page.evaluate(() => {
      const bigData = "x".repeat(5000);
      return Scorm12Adapter._dataOverLimit(bigData, 4095);
    });
    expect(result).toBe(true);
  });

  test('should warn when data is within 10% of limit', async () => {
    const result = await page.evaluate(() => {
      const logs = [];
      const originalWarn = console.warn;
      console.warn = (msg) => logs.push(msg);
      
      // 4095 * 0.9 = 3685.5, so 3686 chars should trigger warning
      const data = "x".repeat(3686);
      Scorm12Adapter._dataOverLimit(data, 4095);
      
      console.warn = originalWarn;
      return logs.some(log => log.includes("within"));
    });
    expect(result).toBe(true);
  });

  test('should return true for null data', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._dataOverLimit(null, 4095);
    });
    expect(result).toBe(true);
  });

  test('should return true for number data', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._dataOverLimit(12345, 4095);
    });
    expect(result).toBe(true);
  });

  test('should not warn when data is far from limit', async () => {
    const result = await page.evaluate(() => {
      const logs = [];
      const originalWarn = console.warn;
      console.warn = (msg) => logs.push(msg);
      
      const data = "x".repeat(100);
      Scorm12Adapter._dataOverLimit(data, 4095);
      
      console.warn = originalWarn;
      return logs.length === 0;
    });
    expect(result).toBe(true);
  });
});
