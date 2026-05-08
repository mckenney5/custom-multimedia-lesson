const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('log', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should log events correctly', async () => {
    const result = await page.evaluate(() => {
      // Clear event buffer
      journaler._eventBuffer = [];

      // Test logging
      journaler.log('PAGE_COMPLETE', 5);
      journaler.log('VIDEO_PLAY', 'vid1');
      journaler.log('USER_IDLE', true);

      // Check that events were added to buffer
      return journaler._eventBuffer.length === 3 &&
             journaler._eventBuffer[0].includes(',1,5') && // PAGE_COMPLETE is encoded as "1"
             journaler._eventBuffer[1].includes(',a,vid1') && // VIDEO_PLAY is encoded as "a"
             journaler._eventBuffer[2].includes(',l,true'); // USER_IDLE is encoded as "l"
    });

    expect(result).toBe(true);
  });

  test('should log invalid actions as DIAGNOSTIC event', async () => {
    const result = await page.evaluate(() => {
      journaler._eventBuffer = [];
      journaler.log("INVALID_ACTION", "test_value");

      const logEntry = journaler._eventBuffer[0];
      const diagnosticCode = journaler._encoding["DIAGNOSTIC"];
      return logEntry.includes(`,${diagnosticCode},`) &&
             logEntry.includes("Unknown action 'INVALID_ACTION' test_value");
    });

    expect(result).toBe(true);
  });
});
