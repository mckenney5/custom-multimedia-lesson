const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('uint8ToBase64', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should convert uint8 array to Base64 string', async () => {
    const result = await page.evaluate(() => {
      const testCases = [
        { input: new Uint8Array([0]), expected: 'AA==' },
        { input: new Uint8Array([255]), expected: '/w==' },
        { input: new Uint8Array([0, 255]), expected: 'AP8=' },
        { input: new Uint8Array([72, 101, 108, 108, 111]), expected: 'SGVsbG8=' }
      ];
      return testCases.every(({ input, expected }) => journaler._uint8ToBase64(input) === expected);
    });
    expect(result).toBe(true);
  });
});
