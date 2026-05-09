const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('LocalStorageAdapter.setScore()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should save score to localStorage', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      LocalStorageAdapter.setScore(85, 100);
      return localStorage.getItem("course_data_score");
    });
    expect(result).toBe("85");
  });

  test('should log score setting', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      const logs = [];
      const originalLog = console.log;
      console.log = (msg) => logs.push(msg);

      LocalStorageAdapter.setScore(0.85, 1.0);

      console.log = originalLog;
      return logs.some(log => log.includes("Setting Score"));
    });
    expect(result).toBe(true);
  });

  test('should handle zero score', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      LocalStorageAdapter.setScore(0, 100);
      return localStorage.getItem("course_data_score");
    });
    expect(result).toBe("0");
  });

  test('should handle perfect score', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      LocalStorageAdapter.setScore(100, 100);
      return localStorage.getItem("course_data_score");
    });
    expect(result).toBe("100");
  });

  test('should return false when maxScore is 0', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      return LocalStorageAdapter.setScore(50, 0);
    });
    expect(result).toBe(false);
  });

  test('should handle decimal scores', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      LocalStorageAdapter.setScore(0.5, 1.0);
      return localStorage.getItem("course_data_score");
    });
    expect(result).toBe("0.5");
  });
});