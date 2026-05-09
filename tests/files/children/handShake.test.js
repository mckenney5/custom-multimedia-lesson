const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('handShake()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/children.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should process valid ORIGIN message, set connection, remove listener, and call setup', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = null;
      child.pageAPICode = null;
      child.events.eventList = [];

      child.init();

      const listenerCountBefore = child.events.eventList.length;

      const setupCalled = [];
      const originalSetup = child.setup;
      child.setup = () => {
        setupCalled.push(true);
      };

      const originMessage = {
        data: {
          type: "ORIGIN",
          message: "http://parent.origin",
          code: "TEST_API_CODE"
        },
        origin: "http://parent.origin"
      };

      try {
        child.handShake(originMessage);

        return {
          parentOriginSet: child.parentOrigin === "http://parent.origin",
          pageAPICodeSet: child.pageAPICode === "TEST_API_CODE",
          listenerCountBefore,
          listenerCountAfter: child.events.eventList.length,
          handshakeListenerRemoved: child.events.eventList.length < listenerCountBefore,
          setupCalled: setupCalled.length > 0
        };
      } finally {
        child.setup = originalSetup;
      }
    });

    expect(result.parentOriginSet).toBe(true);
    expect(result.pageAPICodeSet).toBe(true);
    expect(result.listenerCountBefore).toBe(1);
    expect(result.handshakeListenerRemoved).toBe(true);
    expect(result.setupCalled).toBe(true);
  });

  test('should handle invalid ORIGIN message by logging error', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = null;
      child.pageAPICode = null;

      const errorLog = [];
      const originalError = console.error;
      console.error = (...args) => {
        errorLog.push(args.join(' '));
      };

      try {
        const originMessage = {
          data: {
            type: "ORIGIN",
            message: "http://different.origin",
            code: "TEST_API_CODE"
          },
          origin: "http://parent.origin"
        };

        child.handShake(originMessage);

        return {
          errorLogged: errorLog.length > 0,
          errorLog
        };
      } finally {
        console.error = originalError;
      }
    });

    expect(result.errorLogged).toBe(true);
    expect(result.errorLog[0]).toContain("Handshake failed");
  });
});
