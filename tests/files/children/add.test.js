const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('events.add()', () => {
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

  test('should add event listener without context', async () => {
    const result = await page.evaluate(() => {
      // Account for the initial handshake listener
      const initialListenersBeforeTest = child.events.eventList.length;
      
      // Set up test scenario
      let handlerCalled = false;
      const testHandler = () => { handlerCalled = true; };
      
      // Add event listener without context
      child.events.add('testEvent', testHandler);
      
      // Verify listener was added
      const listenerCount = child.events.eventList.length;
      
      // Check that the listener is in the list with correct properties
      const listener = child.events.eventList.find(e => e.event === 'testEvent' && e.funcName === testHandler);
      const listenerExists = !!listener;
      const handlerIsFunction = typeof listener.handler === 'function';
      
      // Trigger the event to see if handler gets called
      window.dispatchEvent(new Event('testEvent'));
      
      return {
        initialListenersBeforeTest,
        listenerCount,
        listenerExists,
        handlerIsFunction,
        handlerCalled
      };
    });
    
    // We started with 1 listener (handShake), added 1 more
    expect(result.initialListenersBeforeTest).toBe(1);
    expect(result.listenerCount).toBe(2); // 1 initial + 1 added
    expect(result.listenerExists).toBe(true);
    expect(result.handlerIsFunction).toBe(true);
    expect(result.handlerCalled).toBe(true);
  });

  test('should add event listener with context binding', async () => {
    const result = await page.evaluate(() => {
      // Account for the initial handshake listener
      const initialListenersBeforeTest = child.events.eventList.length;
      
      // Set up test scenario
      const testContext = { value: 42 };
      let handlerCalledWithCorrectContext = false;
      
      function testHandler() {
        handlerCalledWithCorrectContext = (this.value === 42);
      }
      
      // Add event listener with context
      child.events.add('testEventContext', testHandler, testContext);
      
      // Verify listener was added
      const listenerCount = child.events.eventList.length;
      
      // Check that the listener is in the list with correct properties
      const listener = child.events.eventList.find(e => e.event === 'testEventContext' && e.funcName === testHandler);
      const listenerExists = !!listener;
      
      // Trigger the event to see if handler gets called with correct context
      window.dispatchEvent(new Event('testEventContext'));
      
      return {
        initialListenersBeforeTest,
        listenerCount,
        listenerExists,
        handlerCalledWithCorrectContext
      };
    });
    
    // We started with 1 listener (handShake), added 1 more
    expect(result.initialListenersBeforeTest).toBe(1);
    expect(result.listenerCount).toBe(2); // 1 initial + 1 added
    expect(result.listenerExists).toBe(true);
    expect(result.handlerCalledWithCorrectContext).toBe(true);
  });
});