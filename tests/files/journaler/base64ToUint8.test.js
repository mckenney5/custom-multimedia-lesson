const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('base64ToUint8', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should convert Base64 string to uint8 array', async () => {
    const result = await page.evaluate(() => {
      const testCases = [
        { input: 'AA==', expected: new Uint8Array([0]) },
        { input: '/w==', expected: new Uint8Array([255]) },
        { input: 'AP8=', expected: new Uint8Array([0, 255]) },
        { input: 'SGVsbG8=', expected: new Uint8Array([72, 101, 108, 108, 111]) }
      ];
      return testCases.every(({ input, expected }) => {
        const result = journaler._base64ToUint8(input);
        return result.length === expected.length && result.every((val, idx) => val === expected[idx]);
      });
    });
    expect(result).toBe(true);
  });
});
