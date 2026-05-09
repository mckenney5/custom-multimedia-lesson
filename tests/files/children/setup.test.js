const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('setup()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    // Load children.js for this test
    await page.addScriptTag({ path: '../src/internal/children.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should add receive listener and send SEND_META', async () => {
    const result = await page.evaluate(() => {
      // Store original values
      const originalPostMessage = window.parent.postMessage;
      let postMessageCalled = false;
      let postMessageArgs = null;
      
      // Mock postMessage
      window.parent.postMessage = (...args) => {
        postMessageCalled = true;
        postMessageArgs = args;
      };
      
      try {
        // Set up the state as if handshake has occurred
        child.pageAPICode = 'TEST_CODE';
        child.parentOrigin = 'http://parent.origin';
        
        // Count initial listeners
        const initialListenersCount = child.events.eventList.length;
        
        // Call setup
        child.setup();
        
        // Check that receive listener was added
        const listenersAfterSetup = child.events.eventList.length;
        const receiveListenerAdded = listenersAfterSetup > initialListenersCount;
        
        // Check that SEND_META was sent
        const sendMetaSent = postMessageCalled && 
                            postMessageArgs[0] && 
                            postMessageArgs[0].type === 'SEND_META';
        
        return {
          receiveListenerAdded,
          sendMetaSent,
          listenersAfterSetup
        };
      } finally {
        // Restore original postMessage
        window.parent.postMessage = originalPostMessage;
      }
    });
    
    expect(result.receiveListenerAdded).toBe(true);
    expect(result.sendMetaSent).toBe(true);
  });
});