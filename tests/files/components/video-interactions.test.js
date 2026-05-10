const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseVideo interactions via DOM', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should have play button with icon SVG', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test.mp4');
      video.render();
      video.attachListeners();
      return video.playBtn.innerHTML.includes('svg');
    });
    expect(result).toBe(true);
  });

  test('should have rewind button with aria-label', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test.mp4');
      video.render();
      video.attachListeners();
      return video.rewindButton.getAttribute('aria-label');
    });
    expect(result).toContain('Rewind');
  });

  test('should have forward button with aria-label', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test.mp4');
      video.render();
      video.attachListeners();
      return video.forwardButton.getAttribute('aria-label');
    });
    expect(result).toContain('Forward');
  });

  test('should have mute button with aria-label', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test.mp4');
      video.render();
      video.attachListeners();
      return video.muteBtn.getAttribute('aria-label');
    });
    expect(result).toContain('Mute');
  });

  test('should have fullscreen button with title', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test.mp4');
      video.render();
      video.attachListeners();
      return video.fullScreenButton.title;
    });
    expect(result).toBe('Full Screen');
  });

  test('should have speed selector with default value 1x', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test.mp4');
      video.render();
      video.attachListeners();
      return video.speedSelect.value;
    });
    expect(result).toBe('1');
  });

  test('should have all 7 speed options', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test.mp4');
      video.render();
      return video.speedSelect.options.length;
    });
    expect(result).toBe(7);
  });

  test('should format time correctly with formatTime helper', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      return video.formatTime(125);
    });
    expect(result).toBe('2:05');
  });

  test('should format zero time correctly', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      return video.formatTime(0);
    });
    expect(result).toBe('0:00');
  });

  test('should format large time correctly', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      return video.formatTime(3661);
    });
    expect(result).toBe('61:01');
  });
});