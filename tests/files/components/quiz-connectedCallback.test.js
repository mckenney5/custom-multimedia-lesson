const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseQuiz connectedCallback()', () => {
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
      const quiz = document.createElement('course-quiz');
      quiz.connectedCallback();
      CourseComponent.prototype.connectedCallback = originalSuper;
      return superCalled;
    });
    expect(result).toBe(true);
  });

  test('should set up bound handlers', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.connectedCallback();
      return {
        hasBoundHandler: typeof quiz._boundQuizHandler === 'function',
        hasBoundResults: typeof quiz._boundQuizResults === 'function'
      };
    });
    expect(result.hasBoundHandler).toBe(true);
    expect(result.hasBoundResults).toBe(true);
  });

  test('should add quiz-data and quiz-results listeners', async () => {
    const result = await page.evaluate(() => {
      let dataListenerAdded = false;
      let resultsListenerAdded = false;
      const originalAdd = window.addEventListener;
      window.addEventListener = function(type) {
        if (type === 'quiz-data') dataListenerAdded = true;
        if (type === 'quiz-results') resultsListenerAdded = true;
      };
      const quiz = document.createElement('course-quiz');
      quiz.connectedCallback();
      window.addEventListener = originalAdd;
      return { dataListenerAdded, resultsListenerAdded };
    });
    expect(result.dataListenerAdded).toBe(true);
    expect(result.resultsListenerAdded).toBe(true);
  });
});