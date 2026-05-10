const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseArticle render()', () => {
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

  test('should set display to block', async () => {
    const result = await page.evaluate(() => {
      // Create a course-article element
      const article = document.createElement('course-article');
      
      // Call render method
      article.render();
      
      // Return the display style
      return article.style.display;
    });

    expect(result).toBe('block');
  });

  test('should request student data when needsStudentInfo is true', async () => {
    const result = await page.evaluate(() => {
      // Create a course-article element with needsStudentInfo="true"
      const article = document.createElement('course-article');
      article.setAttribute('needsStudentInfo', 'true');
      
      // Spy on requestStudentData
      const originalRequestStudentData = article.requestStudentData;
      let requestCalled = false;
      article.requestStudentData = function() {
        requestCalled = true;
        // Call original method
        return originalRequestStudentData.apply(this, arguments);
      };
      
      // Call render method
      article.render();
      
      return requestCalled;
    });

    expect(result).toBe(true);
  });

  test('should not request student data when needsStudentInfo is false', async () => {
    const result = await page.evaluate(() => {
      // Create a course-article element with needsStudentInfo="false"
      const article = document.createElement('course-article');
      article.setAttribute('needsStudentInfo', 'false');
      
      // Spy on requestStudentData
      const originalRequestStudentData = article.requestStudentData;
      let requestCalled = false;
      article.requestStudentData = function() {
        requestCalled = true;
        // Call original method
        return originalRequestStudentData.apply(this, arguments);
      };
      
      // Call render method
      article.render();
      
      return requestCalled;
    });

    expect(result).toBe(false);
  });

  test('should not request student data when needsStudentInfo is not set', async () => {
    const result = await page.evaluate(() => {
      // Create a course-article element without needsStudentInfo attribute
      const article = document.createElement('course-article');
      
      // Spy on requestStudentData
      const originalRequestStudentData = article.requestStudentData;
      let requestCalled = false;
      article.requestStudentData = function() {
        requestCalled = true;
        // Call original method
        return originalRequestStudentData.apply(this, arguments);
      };
      
      // Call render method
      article.render();
      
      return requestCalled;
    });

    expect(result).toBe(false);
  });
});