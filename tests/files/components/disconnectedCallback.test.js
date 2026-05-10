const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseComponent disconnectedCallback()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should remove student-data event listener', async () => {
    const result = await page.evaluate(() => {
      let listenerRemoved = false;
      const originalRemove = window.removeEventListener;
      window.removeEventListener = function(type) {
        if (type === 'student-data') listenerRemoved = true;
      };
      const video = document.createElement('course-video');
      video._boundDataHandler = function() {};
      video.disconnectedCallback();
      window.removeEventListener = originalRemove;
      return listenerRemoved;
    });
    expect(result).toBe(true);
  });

  test('should call cancel when speechSynthesis exists', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      let cancelCalled = false;
      if ('speechSynthesis' in window) {
        const originalCancel = window.speechSynthesis.cancel;
        window.speechSynthesis.cancel = function() { cancelCalled = true; };
        video.disconnectedCallback();
        window.speechSynthesis.cancel = originalCancel;
        return cancelCalled;
      }
      return false;
    });
    expect(result).toBe(true);
  });

  test('should not throw when no listener exists', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      video._boundDataHandler = undefined;
      try {
        video.disconnectedCallback();
        return 'no error';
      } catch(e) {
        return e.message;
      }
    });
    expect(result).toBe('no error');
  });
});