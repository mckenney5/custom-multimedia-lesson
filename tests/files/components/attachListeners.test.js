const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseVideo attachListeners()', () => {
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
      // Create a course-video element
      const video = document.createElement('course-video');
      // Check that the method exists and is a function
      return typeof video.attachListeners === 'function';
    });

    expect(result).toBe(true);
  });

  test('should be called during connectedCallback', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element with src attribute
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test-video.mp4');
      
      // Spy on attachListeners by wrapping it
      const originalAttachListeners = video.attachListeners;
      let attachListenersCalled = false;
      video.attachListeners = function() {
        attachListenersCalled = true;
        // Call original method
        return originalAttachListeners.apply(this, arguments);
      };
      
      // Call connectedCallback which should trigger attachListeners
      video.connectedCallback();
      
      return attachListenersCalled;
    });

    expect(result).toBe(true);
  });
});