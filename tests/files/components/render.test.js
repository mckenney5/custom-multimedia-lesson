const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseVideo render()', () => {
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

  test('should generate correct HTML structure with src attribute', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element with src attribute
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test-video.mp4');
      
      // Call render method
      video.render();
      
      // Return the innerHTML to check if it was generated correctly
      return video.innerHTML;
    });

    // Check that the video source is in the generated HTML
    expect(result).toContain('src="test-video.mp4"');
    // Check that the video container is present
    expect(result).toContain('id="video-container"');
    // Check that the video player element is present
    expect(result).toContain('id="vid-player"');
  });

  test('should handle poster attribute', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element with src and poster attributes
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test-video.mp4');
      video.setAttribute('poster', 'test-poster.jpg');
      
      // Call render method
      video.render();
      
      // Return the innerHTML to check if it was generated correctly
      return video.innerHTML;
    });

    // Check that both src and poster are in the generated HTML
    expect(result).toContain('src="test-video.mp4"');
    expect(result).toContain('poster="test-poster.jpg"');
  });

  test('should handle captions attribute', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element with src and captions attributes
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test-video.mp4');
      video.setAttribute('captions', 'test-captions.vtt');
      
      // Call render method
      video.render();
      
      // Return the innerHTML to check if it was generated correctly
      return video.innerHTML;
    });

    // Check that src and captions track are in the generated HTML
    expect(result).toContain('src="test-video.mp4"');
    expect(result).toContain('src="test-captions.vtt"');
    expect(result).toContain('kind="captions"');
  });
});