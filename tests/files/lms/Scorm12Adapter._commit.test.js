const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter._commit()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should return true on successful SCORM.save', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        save: () => true
      };
      
      return Scorm12Adapter._commit();
    });
    expect(result).toBe(true);
  });

  test('should return false on SCORM.save failure', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        save: () => false,
        debug: {
          getCode: () => "101",
          getInfo: () => "Save failed",
          getDiagnosticInfo: () => "Diagnostic"
        }
      };
      
      return Scorm12Adapter._commit();
    });
    expect(result).toBe(false);
  });

  test('should log when debugging is enabled', async () => {
    const result = await page.evaluate(() => {
      const logs = [];
      const originalLog = console.log;
      console.log = (msg) => logs.push(msg);
      
      // Set debugging flag if it exists
      const debuggingBackup = typeof debugging !== 'undefined' ? debugging : false;
      
      try {
        window.debugging = true;
        
        window.pipwerks = window.pipwerks || {};
        window.pipwerks.SCORM = {
          save: () => true
        };
        
        Scorm12Adapter._commit();
      } finally {
        window.debugging = debuggingBackup;
        console.log = originalLog;
      }
      
      return logs.some(log => log.includes("Sending changes to LMS"));
    });
    expect(result).toBe(true);
  });
});
