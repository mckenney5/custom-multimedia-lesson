const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('Scorm12Adapter._formatTime()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should format 0ms as 0000:00:00.00', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._formatTime(0);
    });
    expect(result).toBe('0000:00:00.00');
  });

  test('should format 1000ms (1 second)', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._formatTime(1000);
    });
    expect(result).toBe('0000:00:01.00');
  });

  test('should format 60000ms (1 minute)', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._formatTime(60000);
    });
    expect(result).toBe('0000:01:00.00');
  });

  test('should format 3600000ms (1 hour)', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._formatTime(3600000);
    });
    expect(result).toBe('0001:00:00.00');
  });

  test('should format 3661000ms (1h 1m 1s)', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._formatTime(3661000);
    });
    expect(result).toBe('0001:01:01.00');
  });

  test('should truncate to last 4 digits when over 9999 hours', async () => {
    const result = await page.evaluate(() => {
      const ms = 10000 * 3600000;
      return Scorm12Adapter._formatTime(ms);
    });
    expect(result).toBe('0000:00:00.00');
  });

  test('should format with 2 decimal places for seconds', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._formatTime(1500);
    });
    expect(result).toBe('0000:00:01.50');
  });

  test('should handle negative milliseconds by returning zeros', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._formatTime(-1000);
    });
    expect(result).toBe('0000:00:00.00');
  });

  test('should handle 9999 hours correctly', async () => {
    const result = await page.evaluate(() => {
      const ms = 9999 * 3600000;
      return Scorm12Adapter._formatTime(ms);
    });
    expect(result).toBe('9999:00:00.00');
  });

  test('should keep last 4 digits for values over 9999 hours', async () => {
    const result = await page.evaluate(() => {
      const ms = 12345 * 3600000;
      return Scorm12Adapter._formatTime(ms);
    });
    expect(result).toBe('2345:00:00.00');
  });

   test('should handle very small millisecond values (rounds to 0.00)', async () => {
     const result = await page.evaluate(() => {
       return Scorm12Adapter._formatTime(1);
     });
     expect(result).toBe('0000:00:00.00');
   });

  test('should handle NaN input by returning zeros', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._formatTime(NaN);
    });
    expect(result).toBe('0000:00:00.00');
  });

  test('should handle Infinity by returning zeros', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._formatTime(Infinity);
    });
    expect(result).toBe('0000:00:00.00');
  });

  test('should handle negative Infinity by returning zeros', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._formatTime(-Infinity);
    });
    expect(result).toBe('0000:00:00.00');
  });

  test('should handle undefined by returning zeros', async () => {
    const result = await page.evaluate(() => {
      return Scorm12Adapter._formatTime(undefined);
    });
    expect(result).toBe('0000:00:00.00');
  });
});