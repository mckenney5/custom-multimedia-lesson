const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter.setSessionTime()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should set session_time with formatted time', async () => {
    const result = await page.evaluate(() => {
      const setCalls = [];
      
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete",
        set: (key, value) => {
          setCalls.push({ key, value });
          return true;
        },
        save: () => true
      };
      
      Scorm12Adapter.init();
      Scorm12Adapter.setSessionTime(3661000); // 1h 1m 1s
      
      const sessionTimeCall = setCalls.find(c => c.key === "cmi.core.session_time");
      return sessionTimeCall ? sessionTimeCall.value : null;
    });
    expect(result).toBe("0001:01:01.00");
  });

  test('should format time correctly for various values', async () => {
    const result = await page.evaluate(() => {
      const times = [];
      
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete",
        set: (key, value) => {
          if (key === "cmi.core.session_time") times.push(value);
          return true;
        },
        save: () => true
      };
      
      Scorm12Adapter.init();
      
      // Test 0ms
      Scorm12Adapter.setSessionTime(0);
      // Test 1000ms (1 second)
      Scorm12Adapter.setSessionTime(1000);
      
      return times;
    });
    expect(result[0]).toBe("0000:00:00.00");
    expect(result[1]).toBe("0000:00:01.00");
  });
});
