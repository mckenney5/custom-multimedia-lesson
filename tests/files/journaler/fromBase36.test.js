const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('fromBase36', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should convert Base36 strings to numbers', async () => {
    const result = await page.evaluate(() => {
      const testCases = [
        { input: '0', expected: 0 },
        { input: '1', expected: 1 },
        { input: 'a', expected: 10 },
        { input: 'z', expected: 35 },
        { input: '10', expected: 36 },
        { input: '9ix', expected: 12345 },
        { input: 'zz', expected: 1295 }
      ];
      return testCases.every(({ input, expected }) => journaler._fromBase36(input) === expected);
    });
    expect(result).toBe(true);
  });

  test('should correctly decode Base36 strings to numbers', async () => {
    const result = await page.evaluate(() => {
      const testCases = [
        { input: 0, encoded: '0', expected: 0 },
        { input: 1, encoded: '1', expected: 1 },
        { input: 10, encoded: 'a', expected: 10 },
        { input: 35, encoded: 'z', expected: 35 },
        { input: 36, encoded: '10', expected: 36 },
        { input: 12345, encoded: '9ix', expected: 12345 },
        { input: Number.MAX_SAFE_INTEGER, encoded: Number.MAX_SAFE_INTEGER.toString(36), expected: Number.MAX_SAFE_INTEGER }
      ];
      return testCases.every(({ input, encoded, expected }) => {
        const encodedValue = journaler._toBase36(input);
        const encodedCorrect = encodedValue === encoded;
        const decodedValue = journaler._fromBase36(encoded);
        const decodedCorrect = decodedValue === expected;
        return encodedCorrect && decodedCorrect;
      });
    });
    expect(result).toBe(true);
  });
});
