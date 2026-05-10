const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseArticle checkScroll() - Real DOM Behavior', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should return early when scrollHeight is 0', async () => {
    const result = await page.evaluate(() => {
      const article = document.createElement('course-article');
      let sendCalled = false;
      article.send = function() { sendCalled = true; };
      Object.defineProperty(document.body, 'scrollHeight', { get: () => 0 });
      article.checkScroll();
      return sendCalled;
    });
    expect(result).toBe(false);
  });

  test('should send PAGE_SCROLLED when near bottom - no scroll needed', async () => {
    const result = await page.evaluate(() => {
      let sendType = null;
      let sendMessage = null;
      const article = document.createElement('course-article');
      article.send = function(type, msg) { sendType = type; sendMessage = msg; };
      Object.defineProperty(document.body, 'scrollHeight', { get: () => 100, configurable: true });
      Object.defineProperty(window, 'scrollY', { get: () => 90, configurable: true });
      Object.defineProperty(window, 'innerHeight', { get: () => 20, configurable: true });
      article.checkScroll();
      return { type: sendType, message: sendMessage };
    });
    expect(result.type).toBe('PAGE_SCROLLED');
    expect(result.message).toBe(true);
  });

  test('should not send PAGE_SCROLLED when far from bottom', async () => {
    const result = await page.evaluate(() => {
      let sendType = null;
      const article = document.createElement('course-article');
      article.send = function(type) { sendType = type; };
      Object.defineProperty(document.body, 'scrollHeight', { get: () => 1000, configurable: true });
      Object.defineProperty(window, 'scrollY', { get: () => 0, configurable: true });
      Object.defineProperty(window, 'innerHeight', { get: () => 500, configurable: true });
      article.checkScroll();
      return sendType;
    });
    expect(result).toBe(null);
  });

  test('should remove scroll listener after reaching bottom', async () => {
    const result = await page.evaluate(() => {
      let removed = false;
      const originalRemove = window.removeEventListener;
      window.removeEventListener = function(type) { if (type === 'scroll') removed = true; };
      const article = document.createElement('course-article');
      article._onScroll = function() {};
      Object.defineProperty(document.body, 'scrollHeight', { get: () => 100, configurable: true });
      Object.defineProperty(window, 'scrollY', { get: () => 90, configurable: true });
      Object.defineProperty(window, 'innerHeight', { get: () => 20, configurable: true });
      article.checkScroll();
      window.removeEventListener = originalRemove;
      return removed;
    });
    expect(result).toBe(true);
  });

  test('should handle edge case at exactly bottom', async () => {
    const result = await page.evaluate(() => {
      let sendType = null;
      const article = document.createElement('course-article');
      article.send = function(type) { sendType = type; };
      Object.defineProperty(document.body, 'scrollHeight', { get: () => 100, configurable: true });
      Object.defineProperty(window, 'scrollY', { get: () => 90, configurable: true });
      Object.defineProperty(window, 'innerHeight', { get: () => 10, configurable: true });
      article.checkScroll();
      return sendType;
    });
    expect(result).toBe('PAGE_SCROLLED');
  });
});