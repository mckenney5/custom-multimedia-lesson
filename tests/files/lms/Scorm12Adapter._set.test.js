const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter._set()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should return true on successful SCORM.set', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        set: () => true
      };
      
      return Scorm12Adapter._set("cmi.core.lesson_status", "completed");
    });
    expect(result).toBe(true);
  });

  test('should call pipwerks.SCORM.set with correct args', async () => {
    const result = await page.evaluate(() => {
      const calls = [];
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        set: (key, value) => {
          calls.push({ key, value });
          return true;
        }
      };
      
      Scorm12Adapter._set("cmi.core.score.raw", "85");
      
      return calls[0];
    });
    expect(result).toEqual({ key: "cmi.core.score.raw", value: "85" });
  });

  test('should call _throwError on SCORM.set failure', async () => {
    const result = await page.evaluate(() => {
      const errors = [];
      const originalError = console.error;
      console.error = (msg) => errors.push(msg);
      
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        set: () => false,
        debug: {
          getCode: () => "101",
          getInfo: () => "General error",
          getDiagnosticInfo: () => "Diagnostic details"
        }
      };
      
      const result = Scorm12Adapter._set("cmi.core.lesson_status", "completed");
      
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
