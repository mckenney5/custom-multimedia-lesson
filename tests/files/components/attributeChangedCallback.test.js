const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseVideo attributeChangedCallback()', () => {
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

  test('should update video element src when src attribute changes', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element
      const video = document.createElement('course-video');
      video.setAttribute('src', 'initial.mp4');
      
      // Trigger connectedCallback to initialize videoElem
      video.connectedCallback();
      
      // Store initial src
      const initialSrc = video.videoElem.src;
      
      // Change the src attribute
      video.setAttribute('src', 'new-video.mp4');
      
      // Trigger attributeChangedCallback
      video.attributeChangedCallback('src', 'initial.mp4', 'new-video.mp4');
      
      // Return the new src
      return video.videoElem.src;
    });

    // Check that the src was updated
    expect(result).toContain('new-video.mp4');
    expect(result).not.toContain('initial.mp4');
  });

  test('should do nothing if videoElem is not initialized', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element but don't call connectedCallback
      const video = document.createElement('course-video');
      
      // This should not throw an error
      video.attributeChangedCallback('src', 'old.mp4', 'new.mp4');
      
      return 'no error';
    });

    expect(result).toBe('no error');
  });
});