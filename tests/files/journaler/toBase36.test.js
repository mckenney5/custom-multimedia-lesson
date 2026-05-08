const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('toBase36', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should convert numbers to Base36 string', async () => {
    const result = await page.evaluate(() => {
      const testCases = [
        { input: 0, expected: '0' },
        { input: 1, expected: '1' },
        { input: 10, expected: 'a' },
        { input: 35, expected: 'z' },
        { input: 36, expected: '10' },
        { input: 12345, expected: '9ix' },
        { input: Number.MAX_SAFE_INTEGER, expected: Number.MAX_SAFE_INTEGER.toString(36) }
      ];
      return testCases.every(({ input, expected }) => journaler._toBase36(input) === expected);
    });
    expect(result).toBe(true);
  });
});
