const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter.saveData()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should save data successfully', async () => {
    const result = await page.evaluate(() => {
      const setCalls = [];
      
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete",
        set: (key, value) => {
          setCalls.push({ key, value });
          return true;
        },
        save: () => true
      };
      
      Scorm12Adapter.init();
      const success = Scorm12Adapter.saveData("test data");
      
      return {
        success: success,
        dataSet: setCalls.some(call => 
          call.key === "cmi.suspend_data" && call.value === "test data"
        )
      };
    });
    expect(result.success).toBe(true);
    expect(result.dataSet).toBe(true);
  });

  test('should return false if data exceeds limit', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete",
        set: () => true,
        save: () => true
      };
      
      Scorm12Adapter.init();
      const bigData = "x".repeat(5000);
      const success = Scorm12Adapter.saveData(bigData);
      
      return success;
    });
    expect(result).toBe(false);
  });

  test('should commit after successful save', async () => {
    const result = await page.evaluate(() => {
      const saveCalled = [];

      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete",
        set: () => true,
        save: () => {
          saveCalled.push(true);
          return true;
        }
      };

      Scorm12Adapter.init();
      Scorm12Adapter.saveData("test");

      return saveCalled.length > 0;
    });
    expect(result).toBe(true);
  });

  test('should reject data exactly at 4095 character limit', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete",
        set: () => true,
        save: () => true
      };

      Scorm12Adapter.init();
      const exactLimit = "x".repeat(4095);
      const success = Scorm12Adapter.saveData(exactLimit);
      return success;
    });
    expect(result).toBe(true);
  });

  test('should reject data exceeding 4095 character limit', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete",
        set: () => true,
        save: () => true
      };

      Scorm12Adapter.init();
      const overLimit = "x".repeat(4096);
      const success = Scorm12Adapter.saveData(overLimit);
      return success;
    });
    expect(result).toBe(false);
  });

  test('should accept data just under 4095 character limit', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete",
        set: () => true,
        save: () => true
      };

      Scorm12Adapter.init();
      const underLimit = "x".repeat(4094);
      const success = Scorm12Adapter.saveData(underLimit);
      return success;
    });
    expect(result).toBe(true);
  });

  test('should return false without commit when data over limit', async () => {
    const result = await page.evaluate(() => {
      const saveCalls = [];
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete",
        set: () => true,
        save: () => {
          saveCalls.push(true);
          return true;
        }
      };

      Scorm12Adapter.init();
      const bigData = "x".repeat(5000);
      const success = Scorm12Adapter.saveData(bigData);
      return { success: success, saveCalled: saveCalls.length };
    });
    expect(result.success).toBe(false);
    expect(result.saveCalled).toBe(0);
  });
});
