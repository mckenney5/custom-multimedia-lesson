const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseArticle connectedCallback()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should call super.connectedCallback()', async () => {
    const result = await page.evaluate(() => {
      let superCalled = false;
      const originalSuper = CourseComponent.prototype.connectedCallback;
      CourseComponent.prototype.connectedCallback = function() {
        superCalled = true;
        return originalSuper.apply(this, arguments);
      };
      const article = document.createElement('course-article');
      article.connectedCallback();
      CourseComponent.prototype.connectedCallback = originalSuper;
      return superCalled;
    });
    expect(result).toBe(true);
  });
});