const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter.init()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should set initialized to true', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete",
        set: () => true,
        save: () => true
      };
      
      Scorm12Adapter.init();
      
      return Scorm12Adapter.initialized;
    });
    expect(result).toBe(true);
  });

  test('should set status to incomplete if status is "not attempted"', async () => {
    const result = await page.evaluate(() => {
      const setCalls = [];
      
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: (key) => {
          if (key === "cmi.core.lesson_status") return "not attempted";
          return null;
        },
        set: (key, value) => {
          setCalls.push({ key, value });
          return true;
        },
        save: () => true
      };
      
      Scorm12Adapter.init();
      
      return setCalls.some(call => 
        call.key === "cmi.core.lesson_status" && call.value === "incomplete"
      );
    });
    expect(result).toBe(true);
  });

  test('should set status to incomplete if status is "unknown"', async () => {
    const result = await page.evaluate(() => {
      const setCalls = [];
      
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: (key) => {
          if (key === "cmi.core.lesson_status") return "unknown";
          return null;
        },
        set: (key, value) => {
          setCalls.push({ key, value });
          return true;
        },
        save: () => true
      };
      
      Scorm12Adapter.init();
      
      return setCalls.some(call => 
        call.key === "cmi.core.lesson_status" && call.value === "incomplete"
      );
    });
    expect(result).toBe(true);
  });

  test('should not change status if already started', async () => {
    const result = await page.evaluate(() => {
      const setCalls = [];
      
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: (key) => {
          if (key === "cmi.core.lesson_status") return "incomplete";
          return null;
        },
        set: (key, value) => {
          setCalls.push({ key, value });
          return true;
        },
        save: () => true
      };
      
      Scorm12Adapter.init();
      
      // set should not be called for lesson_status
      return !setCalls.some(call => call.key === "cmi.core.lesson_status");
    });
    expect(result).toBe(true);
  });
});
