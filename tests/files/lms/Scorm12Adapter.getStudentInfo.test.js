const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter.getStudentName() and getStudentID()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should return student name from SCORM', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: (key) => {
          if (key === "cmi.core.student_name") return "John Doe";
          return null;
        }
      };
      
      return Scorm12Adapter.getStudentName();
    });
    expect(result).toBe("John Doe");
  });

  test('should return student ID from SCORM', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: (key) => {
          if (key === "cmi.core.student_id") return "12345";
          return null;
        }
      };
      
      return Scorm12Adapter.getStudentID();
    });
    expect(result).toBe("12345");
  });

  test('should return null if name not available', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => null
      };
      
      return Scorm12Adapter.getStudentName();
    });
    expect(result).toBeNull();
  });
});
