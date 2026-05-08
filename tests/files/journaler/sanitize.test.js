const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('sanitize', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should sanitize string by removing delimiters', async () => {
    const result = await page.evaluate(() => {
      const testCases = [
        { input: 'hello^world~test`end', expected: 'helloworldtestend' },
        { input: 'no delimiters here', expected: 'no delimiters here' },
        { input: '^^^~~~```', expected: '' },
        { input: 'mixed^content~with`delimiters', expected: 'mixedcontentwithdelimiters' },
        { input: '', expected: '' }
      ];
      return testCases.every(({ input, expected }) => journaler.sanitize(input) === expected);
    });
    expect(result).toBe(true);
  });

  test('should handle non-string inputs by coercing to string', async () => {
    const result = await page.evaluate(() => {
      const testCases = [
        { input: null, expected: 'null' },
        { input: undefined, expected: 'undefined' },
        { input: 123, expected: '123' },
        { input: true, expected: 'true' }
      ];
      return testCases.every(({ input, expected }) => journaler.sanitize(input) === expected);
    });
    expect(result).toBe(true);
  });
});
