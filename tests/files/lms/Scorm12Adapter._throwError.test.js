const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter._throwError()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should return true when error code is "0" (no error)', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        debug: {
          getCode: () => "0",
          getInfo: () => "No error",
          getDiagnosticInfo: () => "No diagnostic"
        }
      };
      
      return Scorm12Adapter._throwError();
    });
    expect(result).toBe(true);
  });

  test('should return false when there is an error', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        debug: {
          getCode: () => "101",
          getInfo: () => "General error",
          getDiagnosticInfo: () => "Diagnostic details"
        }
      };
      
      return Scorm12Adapter._throwError();
    });
    expect(result).toBe(false);
  });

  test('should log error with details', async () => {
    const result = await page.evaluate(() => {
      const errors = [];
      const originalError = console.error;
      console.error = (msg) => errors.push(msg);
      
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        debug: {
          getCode: () => "101",
          getInfo: () => "General error",
          getDiagnosticInfo: () => "Diagnostic details"
        }
      };
      
      Scorm12Adapter._throwError();
      
      console.error = originalError;
      
      const errorString = errors[0] ? errors[0].toString() : "";
      
      return {
        errorLogged: errors.length > 0,
        hasErrorCode: errorString.includes("101"),
        hasErrorInfo: errorString.includes("General error"),
        hasName: errorString.includes("SCORM 1.2")
      };
    });
    expect(result.errorLogged).toBe(true);
    expect(result.hasErrorCode).toBe(true);
    expect(result.hasErrorInfo).toBe(true);
    expect(result.hasName).toBe(true);
  });
});
