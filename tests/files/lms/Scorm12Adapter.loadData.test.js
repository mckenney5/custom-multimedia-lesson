const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter.loadData()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should return suspend_data from SCORM', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: (key) => {
          if (key === "cmi.suspend_data") return "saved lesson data";
          return null;
        }
      };
      
      return Scorm12Adapter.loadData();
    });
    expect(result).toBe("saved lesson data");
  });

  test('should return null if no data saved', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: (key) => {
          if (key === "cmi.suspend_data") return null;
          return null;
        }
      };
      
      return Scorm12Adapter.loadData();
    });
    expect(result).toBeNull();
  });
});
