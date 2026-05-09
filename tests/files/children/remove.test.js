const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('events.remove()', () => {
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

  test('should remove a specific event listener', async () => {
    const result = await page.evaluate(() => {
      // Account for the initial handshake listener
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
      
      // Remove one specific listener
      child.events.remove('testEvent1', testHandler1);
      
      // Verify the specific listener was removed but others remain
      const finalCount = child.events.eventList.length;
      
      // Check that testEvent1 still has one listener (testHandler2)
      const testEvent1Listeners = child.events.eventList.filter(e => e.event === 'testEvent1').length;
      
      return {
        initialListenersBeforeTest,
        initialCount,
        finalCount,
        testEvent1Listeners,
        removedCorrectly: finalCount === (initialCount - 1) && testEvent1Listeners === 1
      };
    });
    
    // We started with 1 listener (handShake), added 3 more, then removed 1
    expect(result.initialListenersBeforeTest).toBe(1);
    expect(result.initialCount).toBe(4); // 1 initial + 3 added
    expect(result.finalCount).toBe(3); // 4 - 1 removed
    expect(result.testEvent1Listeners).toBe(1); // Should still have one listener for testEvent1
    expect(result.removedCorrectly).toBe(true);
  });

  test('should warn when trying to remove non-existent listener', async () => {
    const result = await page.evaluate(() => {
      // Capture console.warn output
      const warnLog = [];
      const originalWarn = console.warn;
      console.warn = (...args) => {
        warnLog.push(args.join(' '));
      };
      
      try {
        // Try to remove a listener that doesn't exist
        child.events.remove('nonExistentEvent', () => {});
        
        // Check if warn was called
        const wasCalled = warnLog.length > 0;
        
        return {
          wasCalled,
          warnLog
        };
      } finally {
        // Restore console.warn
        console.warn = originalWarn;
      }
    });
    
    expect(result.wasCalled).toBe(true);
    expect(result.warnLog[0]).toContain("Could not remove event");
  });
});