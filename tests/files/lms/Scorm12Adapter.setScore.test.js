const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter.setScore()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should calculate percentage correctly', async () => {
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
      Scorm12Adapter.setScore(0.85, 1.0);

      return {
        raw: setCalls.find(c => c.key === "cmi.core.score.raw")?.value,
        max: setCalls.find(c => c.key === "cmi.core.score.max")?.value,
        min: setCalls.find(c => c.key === "cmi.core.score.min")?.value
      };
    });
    expect(result.raw).toBe(85);
    expect(result.max).toBe(100);
    expect(result.min).toBe(0);
  });

  test('should handle different score values', async () => {
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
      Scorm12Adapter.setScore(50, 200);

      return setCalls.find(c => c.key === "cmi.core.score.raw")?.value;
    });
    expect(result).toBe(25);
  });

  test('should handle zero score', async () => {
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
      Scorm12Adapter.setScore(0, 100);

      return setCalls.find(c => c.key === "cmi.core.score.raw")?.value;
    });
    expect(result).toBe(0);
  });

  test('should round fractional scores correctly', async () => {
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
      Scorm12Adapter.setScore(33, 100);

      return setCalls.find(c => c.key === "cmi.core.score.raw")?.value;
    });
    expect(result).toBe(33);
  });

  test('should return false when maxScore is 0', async () => {
    const result = await page.evaluate(() => {
      const errors = [];
      const originalError = console.error;
      console.error = (msg) => errors.push(msg);

      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete",
        set: () => true,
        save: () => true
      };

      Scorm12Adapter.init();
      const success = Scorm12Adapter.setScore(50, 0);

      console.error = originalError;
      return { success, errorLogged: errors.some(e => e.includes("maxScore must be greater than 0")) };
    });
    expect(result.success).toBe(false);
    expect(result.errorLogged).toBe(true);
  });

  test('should return false when maxScore is negative', async () => {
    const result = await page.evaluate(() => {
      window.pipwerks = window.pipwerks || {};
      window.pipwerks.SCORM = {
        get: () => "incomplete",
        set: () => true,
        save: () => true
      };

      Scorm12Adapter.init();
      return Scorm12Adapter.setScore(50, -1);
    });
    expect(result).toBe(false);
  });

  test('should always set max to 100 and min to 0', async () => {
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
      Scorm12Adapter.setScore(25, 200);

      return {
        max: setCalls.find(c => c.key === "cmi.core.score.max")?.value,
        min: setCalls.find(c => c.key === "cmi.core.score.min")?.value
      };
    });
    expect(result.max).toBe(100);
    expect(result.min).toBe(0);
  });
});