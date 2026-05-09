const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('events.removeAll()', () => {
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

  test('should remove all event listeners', async () => {
    const result = await page.evaluate(() => {
      // Account for the initial handshake listener that's added when children.js loads
      const initialListenersBeforeTest = child.events.eventList.length;
      
      // Set up test scenario
      const testEvents = [];
      const testHandler1 = () => { testEvents.push('handler1'); };
      const testHandler2 = () => { testEvents.push('handler2'); };
      
      // Add some event listeners
      child.events.add('testEvent1', testHandler1);
      child.events.add('testEvent2', testHandler2);
      child.events.add('testEvent1', testHandler2); // Add another listener to same event
      
      // Verify listeners were added
      const initialCount = child.events.eventList.length;
      
      // Remove all listeners
      child.events.removeAll();
      
      // Verify all listeners were removed
      const finalCount = child.events.eventList.length;
      
      return {
        initialListenersBeforeTest,
        initialCount,
        finalCount,
        listenersRemoved: finalCount === 0
      };
    });
    
    // We started with 1 listener (handShake), added 3 more, then removed all
    expect(result.initialListenersBeforeTest).toBe(1);
    expect(result.initialCount).toBe(4); // 1 initial + 3 added
    expect(result.finalCount).toBe(0);
    expect(result.listenersRemoved).toBe(true);
  });
});