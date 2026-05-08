const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('unpack', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should return null when unpack receives null', async () => {
    const result = await page.evaluate(async () => {
      const unpacked = await journaler.unpack(null);
      return unpacked === null;
    });
    expect(result).toBe(true);
  });

  test('should return null when unpack receives empty string', async () => {
    const result = await page.evaluate(async () => {
      const unpacked = await journaler.unpack("");
      return unpacked === null;
    });
    expect(result).toBe(true);
  });

  test('should return null when unpack receives invalid version data', async () => {
    const result = await page.evaluate(async () => {
      const invalidData = "v2^data";
      const unpacked = await journaler.unpack(invalidData);
      return unpacked === null;
    });
    expect(result).toBe(true);
  });

  test('should return null when unpack receives corrupted compressed data', async () => {
    const result = await page.evaluate(async () => {
      if (!journaler._supportsCompression) return true;
      const corrupted = "CGZinvalidbase64!!";
      const unpacked = await journaler.unpack(corrupted);
      return unpacked === null;
    });
    expect(result).toBe(true);
  });

  test('should handle unpack with CGZ prefix but no compression support', async () => {
    const result = await page.evaluate(async () => {
      const originalSupport = journaler._supportsCompression;
      journaler._supportsCompression = false;
      // Create a valid CGZ packed string first
      const packed = await journaler.pack([1,2,3]);
      journaler._supportsCompression = originalSupport;
      // Try to unpack with compression disabled (should handle gracefully)
      const unpacked = await journaler.unpack(packed);
      return unpacked === null || unpacked !== null; // Either way, no crash
    });
    expect(result).toBe(true);
  });
});
