const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('events.fire()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/children.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should fire custom event with correct data', async () => {
    const result = await page.evaluate(() => {
      let eventReceived = false;
      let receivedData = null;

      const testSubject = 'testCustomEvent';
      const testData = { key: 'value', number: 42 };

      child.events.add(testSubject, (e) => {
        eventReceived = true;
        receivedData = e.detail;
      });

      child.events.fire(testSubject, testData);

      return {
        eventReceived,
        receivedData,
        dataMatches: JSON.stringify(receivedData) === JSON.stringify(testData)
      };
    });

    expect(result.eventReceived).toBe(true);
    expect(result.dataMatches).toBe(true);
  });
});
