const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('compress/decompress', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should compress and decompress string using Gzip', async () => {
    const result = await page.evaluate(async () => {
      if (!journaler._supportsCompression) {
        return true; // Skip if compression not supported
      }
      const testString = "This is a test string for compression";
      const compressed = await journaler._compressGzip(testString);
      if (compressed === "") return false;
      const decompressed = await journaler._decompressGzip(compressed);
      return decompressed === testString;
    });
    expect(result).toBe(true);
  });

  test('should handle empty string compression', async () => {
    const result = await page.evaluate(async () => {
      if (!journaler._supportsCompression) {
        return true; // Skip if compression not supported
      }
      const testString = "";
      const compressed = await journaler._compressGzip(testString);
      const decompressed = await journaler._decompressGzip(compressed);
      return decompressed === testString;
    });
    expect(result).toBe(true);
  });
});
