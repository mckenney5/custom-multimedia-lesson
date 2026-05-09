const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('LocalStorageAdapter.saveData() and loadData()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should save and load data from localStorage', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      const testData = "test suspend data";
      const saveSuccess = LocalStorageAdapter.saveData(testData);
      const loadedData = LocalStorageAdapter.loadData();
      return {
        saveSuccess: saveSuccess,
        loadedData: loadedData,
        matches: loadedData === testData
      };
    });
    expect(result.saveSuccess).toBe(true);
    expect(result.matches).toBe(true);
  });

  test('should use correct localStorage key with prefix', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      const testData = "sample data";
      LocalStorageAdapter.saveData(testData);
      const raw = localStorage.getItem("course_data_suspend_data");
      return raw === testData;
    });
    expect(result).toBe(true);
  });

  test('lms.saveData and lms.loadData should work after standalone init', async () => {
    const result = await page.evaluate(() => {
      lms.init("standalone");
      const testData = "lesson progress data";
      const saveSuccess = lms.saveData(testData);
      const loadedData = lms.loadData();
      return {
        saveSuccess: saveSuccess,
        loadedData: loadedData,
        matches: loadedData === testData
      };
    });
    expect(result.saveSuccess).toBe(true);
    expect(result.matches).toBe(true);
  });

  test('loadData should return null if nothing saved', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      localStorage.clear();
      return LocalStorageAdapter.loadData();
    });
    expect(result).toBeNull();
  });

  test('should handle empty string data', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      const success = LocalStorageAdapter.saveData("");
      const loaded = LocalStorageAdapter.loadData();
      return { success: success, loaded: loaded };
    });
    expect(result.success).toBe(true);
    expect(result.loaded).toBe("");
  });

  test('should handle special characters', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      const specialData = "Test <>&\"' Data & encoded chars";
      LocalStorageAdapter.saveData(specialData);
      return LocalStorageAdapter.loadData() === specialData;
    });
    expect(result).toBe(true);
  });

  test('should handle unicode characters', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      const unicodeData = "Test 中文 Data العربية";
      LocalStorageAdapter.saveData(unicodeData);
      return LocalStorageAdapter.loadData() === unicodeData;
    });
    expect(result).toBe(true);
  });

  test('should handle large but valid data', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      const largeData = "x".repeat(3000);
      const success = LocalStorageAdapter.saveData(largeData);
      return success;
    });
    expect(result).toBe(true);
  });
});