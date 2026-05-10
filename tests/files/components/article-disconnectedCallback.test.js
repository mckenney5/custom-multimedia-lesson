const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseArticle disconnectedCallback()', () => {
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
      return typeof article.disconnectedCallback === 'function';
    });

    expect(result).toBe(true);
  });

  test('should remove scroll and student-data event listeners', async () => {
    const result = await page.evaluate(() => {
      // Create a course-article element with needsStudentInfo="true"
      const article = document.createElement('course-article');
      article.setAttribute('needsStudentInfo', 'true');
      
      // Store original removeEventListener to track calls
      const originalRemoveEventListener = window.removeEventListener;
      let scrollListenerRemoved = false;
      let studentDataListenerRemoved = false;
      window.removeEventListener = function(eventType, callback) {
        if (eventType === 'scroll') {
          scrollListenerRemoved = true;
        } else if (eventType === 'student-data') {
          studentDataListenerRemoved = true;
        }
        // Call original method
        return originalRemoveEventListener.apply(this, arguments);
      };
      
      // Call connectedCallback to set up listeners
      article.connectedCallback();
      
      // Call disconnectedCallback to remove listeners
      article.disconnectedCallback();
      
      // Restore original method
      window.removeEventListener = originalRemoveEventListener;
      
      return {
        scrollListenerRemoved,
        studentDataListenerRemoved
      };
    });

    expect(result.scrollListenerRemoved).toBe(true);
    expect(result.studentDataListenerRemoved).toBe(true);
  });

  test('should call super.disconnectedCallback()', async () => {
    const result = await page.evaluate(() => {
      // Create a course-article element
      const article = document.createElement('course-article');
      
      // Spy on CourseComponent.prototype.disconnectedCallback
      const originalSuperDisconnectedCallback = CourseComponent.prototype.disconnectedCallback;
      let superCalled = false;
      CourseComponent.prototype.disconnectedCallback = function() {
        superCalled = true;
        return originalSuperDisconnectedCallback.apply(this, arguments);
      };
      
      // Call disconnectedCallback
      article.disconnectedCallback();
      
      // Restore original method
      CourseComponent.prototype.disconnectedCallback = originalSuperDisconnectedCallback;
      
      return superCalled;
    });

    expect(result).toBe(true);
  });
});