const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('children.js - overall initialization', () => {
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

  test('should have all expected functions and properties', async () => {
    const result = await page.evaluate(() => {
      const expectedFunctions = [
        'init',
        'setup', 
        'die',
        'handShake',
        'send',
        'receive'
      ];
      
      const expectedObjects = [
        'events'
      ];
      
      const expectedEventFunctions = [
        'add',
        'remove',
        'removeAll',
        'fire'
      ];
      
      const functionsPresent = expectedFunctions.every(func => typeof child[func] === 'function');
      const objectsPresent = expectedObjects.every(obj => typeof child[obj] === 'object');
      const eventFunctionsPresent = expectedEventFunctions.every(func => typeof child.events[func] === 'function');
      
      return {
        functionsPresent,
        objectsPresent,
        eventFunctionsPresent,
        childExists: typeof child !== 'undefined'
      };
    });
    
    expect(result.childExists).toBe(true);
    expect(result.functionsPresent).toBe(true);
    expect(result.objectsPresent).toBe(true);
    expect(result.eventFunctionsPresent).toBe(true);
  });
});