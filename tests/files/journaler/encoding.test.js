const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('encoding/decoding maps', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should verify encoding/decoding maps completeness', async () => {
    const result = await page.evaluate(() => {
      const encodingKeys = Object.keys(journaler._encoding);
      const decodingValues = Object.values(journaler._decoding);
      const encodingOk = encodingKeys.every(key => journaler._decoding[journaler._encoding[key]] === key);

      const decodingKeys = Object.keys(journaler._decoding);
      const encodingValues = Object.values(journaler._encoding);
      const decodingOk = decodingKeys.every(key => journaler._encoding[journaler._decoding[key]] === key);

      return encodingOk && decodingOk;
    });
    expect(result).toBe(true);
  });
});
