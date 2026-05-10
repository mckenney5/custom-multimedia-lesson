const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseQuiz render()', () => {
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
      // Create a course-quiz element
      const quiz = document.createElement('course-quiz');
      // Check that the method exists and is a function
      return typeof quiz.render === 'function';
    });

    expect(result).toBe(true);
  });

  test('should have empty implementation in base class', async () => {
    const result = await page.evaluate(() => {
      // Create a course-quiz element
      const quiz = document.createElement('course-quiz');
      // Call render method
      quiz.render();
      // Return innerHTML to see if anything was added
      return quiz.innerHTML;
    });

    // The base render method is empty, so innerHTML should remain empty
    expect(result).toBe('');
  });
});