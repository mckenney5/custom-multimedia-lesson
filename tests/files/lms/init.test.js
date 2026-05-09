const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('lms.init()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should initialize in standalone mode', async () => {
    const result = await page.evaluate(() => {
      const success = lms.init("standalone");
      return {
        success: success,
        initialized: lms.initialized,
        driverName: lms.driver.name
      };
    });
    expect(result.success).toBe(true);
    expect(result.initialized).toBe(true);
    expect(result.driverName).toBe("Local Storage");
  });

  test('should allow reinitializing without error', async () => {
    const result = await page.evaluate(() => {
      lms.init("standalone");
      const firstInit = lms.init("standalone");
      return firstInit;
    });
    expect(result).toBe(true);
  });

   test('should initialize with "detect" when no SCORM available', async () => {
     const result = await page.evaluate(() => {
       // Ensure pipwerks is not available
       const pipwerksBackup = window.pipwerks;
       window.pipwerks = undefined;
       
       // Reset lms state
       lms.initialized = false;
       lms.driver = null;
       
       const success = lms.init("detect");
       
       // Restore
       window.pipwerks = pipwerksBackup;
       
       return {
         success: success,
         initialized: lms.initialized,
         driverName: lms.driver.name
       };
     });
     expect(result.success).toBe(true);
     expect(result.initialized).toBe(true);
     expect(result.driverName).toBe("Local Storage");
   });

});
