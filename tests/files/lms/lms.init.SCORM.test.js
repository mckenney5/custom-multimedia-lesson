const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('lms.init() with SCORM modes', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should init with SCORM 1.2 when available', async () => {
    const result = await page.evaluate(() => {
      // Mock pipwerks
      window.pipwerks = {
        SCORM: {
          init: () => true,
          version: "1.2",
          get: () => "incomplete"
        }
      };
      
      // Reset lms state
      lms.initialized = false;
      lms.driver = null;
      
      // Call with "detect" to trigger SCORM 1.2 detection
      const success = lms.init("detect");
      
      return {
        success: success,
        initialized: lms.initialized,
        driverName: lms.driver ? lms.driver.name : null
      };
    });
    expect(result.success).toBe(true);
    expect(result.initialized).toBe(true);
    expect(result.driverName).toBe("SCORM 1.2");
  });

  test('should fallback to standalone if SCORM init fails', async () => {
    const result = await page.evaluate(() => {
      // Mock pipwerks with failed init
      window.pipwerks = {
        SCORM: {
          init: () => false
        }
      };
      
      // Reset lms state
      lms.initialized = false;
      lms.driver = null;
      
      const success = lms.init("detect");
      
      return {
        success: success,
        initialized: lms.initialized,
        driverName: lms.driver ? lms.driver.name : null
      };
    });
    expect(result.success).toBe(true);
    expect(result.initialized).toBe(true);
    expect(result.driverName).toBe("Local Storage");
  });

  test('should init with SCORM 1.2 directly', async () => {
    const result = await page.evaluate(() => {
      // Reset lms state
      lms.initialized = false;
      lms.driver = null;
      
      const success = lms.init("SCORM 1.2");
      
      return {
        success: success,
        initialized: lms.initialized,
        driverName: lms.driver ? lms.driver.name : null
      };
    });
    expect(result.success).toBe(true);
    expect(result.initialized).toBe(true);
    expect(result.driverName).toBe("SCORM 1.2");
  });

  test('should fallback to standalone for SCORM 2004', async () => {
    const result = await page.evaluate(() => {
      // Reset lms state
      lms.initialized = false;
      lms.driver = null;
      
      const logs = [];
      const originalWarn = console.warn;
      console.warn = (msg) => logs.push(msg);
      
      const success = lms.init("SCORM 2004");
      
      console.warn = originalWarn;
      
      return {
        success: success,
        initialized: lms.initialized,
        driverName: lms.driver ? lms.driver.name : null,
        warningLogged: logs.some(log => log.includes("not supported"))
      };
    });
    expect(result.success).toBe(true);
    expect(result.initialized).toBe(true);
    expect(result.driverName).toBe("Local Storage");
    expect(result.warningLogged).toBe(true);
  });
});
