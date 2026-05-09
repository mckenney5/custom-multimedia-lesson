const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('init()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/children.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should set window.child and add handshake listener', async () => {
    const result = await page.evaluate(() => {
      const originalWindowChild = window.child;

      window.child = null;

      child.init();

      const windowChildIsSet = window.child === child;
      const eventListHasMessageListener = child.events.eventList.some(
        e => e.event === 'message' && e.funcName === child.handShake
      );

      window.child = originalWindowChild;

      return {
        windowChildIsSet,
        eventListHasMessageListener
      };
    });

    expect(result.windowChildIsSet).toBe(true);
    expect(result.eventListHasMessageListener).toBe(true);
  });

  test('should set up messagePoller interval', async () => {
    const result = await page.evaluate(() => {
      child.init();

      return {
        pollerSet: child.messagePoller !== null,
        pollerIsNumber: typeof child.messagePoller === 'number'
      };
    });

    expect(result.pollerSet).toBe(true);
    expect(result.pollerIsNumber).toBe(true);
  });

  test('should send ORIGIN postMessage to parent', async () => {
    const result = await page.evaluate(() => {
      const originalPostMessage = window.parent.postMessage;
      let postMessageArgs = null;
      window.parent.postMessage = (...args) => {
        postMessageArgs = args;
      };

      try {
        child.init();

        return {
          postMessageCalled: postMessageArgs !== null,
          messageType: postMessageArgs ? postMessageArgs[0].type : null,
          messageMessage: postMessageArgs ? postMessageArgs[0].message : null,
          targetOrigin: postMessageArgs ? postMessageArgs[1] : null
        };
      } finally {
        window.parent.postMessage = originalPostMessage;
      }
    });

    expect(result.postMessageCalled).toBe(true);
    expect(result.messageType).toBe('ORIGIN');
    expect(result.messageMessage).toBe('');
    expect(result.targetOrigin).toBe('*');
  });
});
