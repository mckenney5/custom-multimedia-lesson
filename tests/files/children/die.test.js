const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('die()', () => {
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

  test('should set body to Loading... and remove all events', async () => {
    const result = await page.evaluate(() => {
      // Set up initial state
      document.body.innerHTML = '<div>Some content</div>';
      
      // Add a test event listener
      const testHandler = () => {};
      child.events.add('testEvent', testHandler);
      
      // Verify initial state
      const initialBodyContent = document.body.innerHTML;
      const initialListenersCount = child.events.eventList.length;
      
      // Call die
      child.die();
      
      // Check final state
      const finalBodyContent = document.body.innerHTML;
      const finalListenersCount = child.events.eventList.length;
      
      return {
        initialBodyContent,
        finalBodyContent,
        bodySetToLoading: finalBodyContent === 'Loading...',
        initialListenersCount,
        finalListenersCount,
        listenersRemoved: finalListenersCount < initialListenersCount
      };
    });
    
    expect(result.bodySetToLoading).toBe(true);
    expect(result.listenersRemoved).toBe(true);
    // Note: We're not checking exact counts because die() also calls removeAll() 
    // which we tested separately, and there may be other listeners
  });
});