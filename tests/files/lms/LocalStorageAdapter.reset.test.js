const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('LocalStorageAdapter.reset()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should clear all data with course_data_ prefix', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      
      // Set some data with prefix
      localStorage.setItem("course_data_suspend_data", "test");
      localStorage.setItem("course_data_status", "completed");
      localStorage.setItem("course_data_score", "85");
      
      // Set some data without prefix (should not be cleared)
      localStorage.setItem("other_data", "should_not_be_cleared");
      
      LocalStorageAdapter.reset();
      
      return {
        suspendCleared: localStorage.getItem("course_data_suspend_data") === null,
        statusCleared: localStorage.getItem("course_data_status") === null,
        scoreCleared: localStorage.getItem("course_data_score") === null,
        otherPreserved: localStorage.getItem("other_data") === "should_not_be_cleared"
      };
    });
    expect(result.suspendCleared).toBe(true);
    expect(result.statusCleared).toBe(true);
    expect(result.scoreCleared).toBe(true);
    expect(result.otherPreserved).toBe(true);
  });

  test('should not throw if no course data exists', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      localStorage.clear();
      try {
        LocalStorageAdapter.reset();
        return true;
      } catch(e) {
        return false;
      }
    });
    expect(result).toBe(true);
  });
});
