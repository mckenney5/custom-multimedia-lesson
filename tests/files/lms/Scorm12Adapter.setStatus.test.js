const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter.setStatus()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should set valid status', async () => {
    const result = await page.evaluate(() => {
      const setCalls = [];
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete", // for init()
        set: (key, value) => {
          setCalls.push({ key, value });
          return true;
        },
        save: () => true
      };
      
      Scorm12Adapter.init();
      const success = Scorm12Adapter.setStatus("completed");
      
      return {
        success: success,
        statusSet: setCalls.some(c => c.key === "cmi.core.lesson_status" && c.value === "completed")
      };
    });
    expect(result.success).toBe(true);
    expect(result.statusSet).toBe(true);
  });

  test('should reject invalid status', async () => {
    const result = await page.evaluate(() => {
      const errors = [];
      const originalError = console.error;
      console.error = (msg) => errors.push(msg);
      
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete", // for init()
        set: () => true,
        save: () => true
      };
      
      Scorm12Adapter.init();
      const success = Scorm12Adapter.setStatus("invalid_status");
      
      console.error = originalError;
      
      return {
        success: success,
        errorLogged: errors.some(e => e.includes("Invalid Lesson Status"))
      };
    });
    expect(result.success).toBe(false);
    expect(result.errorLogged).toBe(true);
  });

  test('should accept all valid statuses', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete", // for init()
        set: () => true,
        save: () => true
      };
      
      Scorm12Adapter.init();
      const validStatuses = ["passed", "completed", "failed", "incomplete", "browsed", "not attempted"];
      
      return validStatuses.every(status => {
        return Scorm12Adapter.setStatus(status) === true;
      });
    });
    expect(result).toBe(true);
  });
});
