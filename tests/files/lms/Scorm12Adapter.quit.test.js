const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter.quit()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should call pipwerks.SCORM.quit()', async () => {
    const result = await page.evaluate(() => {
      let quitCalled = false;
      
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        quit: () => { quitCalled = true; }
      };
      
      Scorm12Adapter.quit();
      
      return quitCalled;
    });
    expect(result).toBe(true);
  });

  test('should log disconnection message', async () => {
    const result = await page.evaluate(() => {
      const logs = [];
      const originalLog = console.log;
      console.log = (msg) => logs.push(msg);
      
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        quit: () => {}
      };
      
      Scorm12Adapter.quit();
      
      console.log = originalLog;
      
      return logs.some(log => log.includes("Disconnected from the LMS"));
    });
    expect(result).toBe(true);
  });
});
