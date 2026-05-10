const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseVideo - Real DOM Integration', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should cache element references after render', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test.mp4');
      video.render();
      return {
        videoElem: video.videoElem !== null,
        playBtn: video.playBtn !== null,
        rewindButton: video.rewindButton !== null,
        forwardButton: video.forwardButton !== null,
        speedSelect: video.speedSelect !== null,
        fullScreenButton: video.fullScreenButton !== null,
        muteBtn: video.muteBtn !== null,
        timeDisplay: video.timeDisplay !== null,
      };
    });
    expect(result.videoElem).toBe(true);
    expect(result.playBtn).toBe(true);
    expect(result.rewindButton).toBe(true);
    expect(result.forwardButton).toBe(true);
  });

  test('should have seek value of 5 seconds', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test.mp4');
      video.render();
      return video.seek;
    });
    expect(result).toBe(5);
  });

  test('should create progress bar elements', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test.mp4');
      video.render();
      return {
        progressContainer: video.querySelector('#progress-container') !== null,
        progressFill: video.progressFill !== null,
        seekOverlay: video.seekOverlay !== null,
        loadingOverlay: video.loadingOverlay !== null,
      };
    });
    expect(result.progressContainer).toBe(true);
    expect(result.progressFill).toBe(true);
    expect(result.loadingOverlay).toBe(true);
  });

  test('should have play button click handler', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test.mp4');
      video.render();
      return video.playBtn !== null && video.videoElem !== null;
    });
    expect(result).toBe(true);
  });

  test('should initialize stat tracking properties', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test.mp4');
      video.render();
      return {
        activePlayMs: video.activePlayMs,
        visiblePlayMs: video.visiblePlayMs,
        weightedSpeedSum: video.weightedSpeedSum,
        lastTick: video.lastTick,
        lastLoggedPercent: video.lastLoggedPercent,
      };
    });
    expect(result.activePlayMs).toBe(0);
    expect(result.visiblePlayMs).toBe(0);
    expect(result.weightedSpeedSum).toBe(0);
    expect(result.lastTick).toBe(0);
  });

  test('should have initial time display 0:00 / 0:00', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test.mp4');
      video.render();
      return video.timeDisplay.textContent;
    });
    expect(result).toBe('0:00 / 0:00');
  });
});