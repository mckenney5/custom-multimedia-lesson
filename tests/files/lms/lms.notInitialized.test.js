const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('lms API when not initialized', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    // Reset lms to not initialized state
    await page.evaluate(() => {
      lms.initialized = false;
      lms.driver = null;
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('getStudentName should return false', async () => {
    const result = await page.evaluate(() => {
      return lms.getStudentName();
    });
    expect(result).toBe(false);
  });

  test('getStudentID should return false', async () => {
    const result = await page.evaluate(() => {
      return lms.getStudentID();
    });
    expect(result).toBe(false);
  });

  test('saveData should return false', async () => {
    const result = await page.evaluate(() => {
      return lms.saveData("test");
    });
    expect(result).toBe(false);
  });

  test('loadData should return null', async () => {
    const result = await page.evaluate(() => {
      return lms.loadData();
    });
    expect(result).toBeNull();
  });

  test('setSessionTime should return false', async () => {
    const result = await page.evaluate(() => {
      return lms.setSessionTime(1000);
    });
    expect(result).toBe(false);
  });

  test('reset should return false', async () => {
    const result = await page.evaluate(() => {
      return lms.reset();
    });
    expect(result).toBe(false);
  });

  test('setScore should return false', async () => {
    const result = await page.evaluate(() => {
      return lms.setScore(85, 100);
    });
    expect(result).toBe(false);
  });

  test('setStatus should return false', async () => {
    const result = await page.evaluate(() => {
      return lms.setStatus("completed");
    });
    expect(result).toBe(false);
  });

  test('quit should return false', async () => {
    const result = await page.evaluate(() => {
      return lms.quit();
    });
    expect(result).toBe(false);
  });
});
