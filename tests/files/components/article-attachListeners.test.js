const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseArticle attachListeners()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    // Load components.js for this test
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should exist and be callable', async () => {
    const result = await page.evaluate(() => {
      // Create a course-article element
      const article = document.createElement('course-article');
      // Check that the method exists and is a function
      return typeof article.attachListeners === 'function';
    });

    expect(result).toBe(true);
  });

  test('should always attach scroll listener', async () => {
    const result = await page.evaluate(() => {
      // Create a course-article element
      const article = document.createElement('course-article');
      
      // Store original addEventListener to track calls
      const originalAddEventListener = window.addEventListener;
      let scrollListenerAdded = false;
      window.addEventListener = function(eventType, callback) {
        if (eventType === 'scroll') {
          scrollListenerAdded = true;
        }
        // Call original method
        return originalAddEventListener.apply(this, arguments);
      };
      
      // Call connectedCallback which should trigger attachListeners
      article.connectedCallback();
      
      // Restore original method
      window.addEventListener = originalAddEventListener;
      
      return scrollListenerAdded;
    });

    expect(result).toBe(true);
  });

  test('should call checkScroll immediately', async () => {
    const result = await page.evaluate(() => {
      // Create a course-article element
      const article = document.createElement('course-article');
      
      // Spy on checkScroll by wrapping it
      const originalCheckScroll = article.checkScroll;
      let checkScrollCalled = false;
      article.checkScroll = function() {
        checkScrollCalled = true;
        // Call original method
        return originalCheckScroll.apply(this, arguments);
      };
      
      // Call connectedCallback which should trigger attachListeners
      article.connectedCallback();
      
      return checkScrollCalled;
    });

    expect(result).toBe(true);
  });

  test('should set up text to speech listener if read-article button is present', async () => {
    const result = await page.evaluate(() => {
      // Create a course-article element with a read-article button
      const article = document.createElement('course-article');
      article.innerHTML = '<button id="read-article">Read</button>';
      
      // Store original addEventListener to track clicks on the button
      const originalAddEventListener = HTMLElement.prototype.addEventListener;
      let clickListenerAdded = false;
      HTMLElement.prototype.addEventListener = function(eventType, callback) {
        if (eventType === 'click') {
          clickListenerAdded = true;
        }
        // Call original method
        return originalAddEventListener.apply(this, arguments);
      };
      
      // Call connectedCallback which should trigger attachListeners
      article.connectedCallback();
      
      // Restore original method
      HTMLElement.prototype.addEventListener = originalAddEventListener;
      
      return clickListenerAdded;
    });

    expect(result).toBe(true);
  });

  test('should not set up text to speech listener if read-article button is absent', async () => {
    const result = await page.evaluate(() => {
      // Create a course-article element without a read-article button
      const article = document.createElement('course-article');
      article.innerHTML = '<p>Some content</p>';
      
      // Store original addEventListener to track clicks on the button
      const originalAddEventListener = HTMLElement.prototype.addEventListener;
      let clickListenerAdded = false;
      HTMLElement.prototype.addEventListener = function(eventType, callback) {
        if (eventType === 'click') {
          clickListenerAdded = true;
        }
        // Call original method
        return originalAddEventListener.apply(this, arguments);
      };
      
      // Call connectedCallback which should trigger attachListeners
      article.connectedCallback();
      
      // Restore original method
      HTMLElement.prototype.addEventListener = originalAddEventListener;
      
      return clickListenerAdded;
    });

    expect(result).toBe(false);
  });
});