const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter.reset()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should clear suspend_data', async () => {
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
      Scorm12Adapter.reset();
      
      const suspendDataCall = setCalls.find(c => c.key === "cmi.suspend_data");
      return suspendDataCall ? suspendDataCall.value : null;
    });
    expect(result).toBe("");
  });

  test('should reset lesson_status to incomplete', async () => {
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
      Scorm12Adapter.reset();
      
      const statusCall = setCalls.find(c => c.key === "cmi.core.lesson_status");
      return statusCall ? statusCall.value : null;
    });
    expect(result).toBe("incomplete");
  });

  test('should clear score values', async () => {
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
      Scorm12Adapter.reset();
      
      const rawCall = setCalls.find(c => c.key === "cmi.core.score.raw");
      const maxCall = setCalls.find(c => c.key === "cmi.core.score.max");
      const minCall = setCalls.find(c => c.key === "cmi.core.score.min");
      
      return {
        raw: rawCall ? rawCall.value : null,
        max: maxCall ? maxCall.value : null,
        min: minCall ? minCall.value : null
      };
    });
    expect(result.raw).toBe("");
    expect(result.max).toBe("");
    expect(result.min).toBe("");
  });

  test('should clear exit state', async () => {
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
      Scorm12Adapter.reset();
      
      const exitCall = setCalls.find(c => c.key === "cmi.core.exit");
      return exitCall ? exitCall.value : null;
    });
    expect(result).toBe("");
  });

  test('should return commit result', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete",
        set: () => true,
        save: () => true
      };
      
      Scorm12Adapter.init();
      return Scorm12Adapter.reset();
    });
    expect(result).toBe(true);
  });
});
