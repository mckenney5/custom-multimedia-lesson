const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseQuiz disconnectedCallback()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should remove quiz-data event listener', async () => {
    const result = await page.evaluate(() => {
      let listenerRemoved = false;
      const originalRemove = window.removeEventListener;
      window.removeEventListener = function(type) {
        if (type === 'quiz-data') listenerRemoved = true;
      };
      const quiz = document.createElement('course-quiz');
      quiz._boundQuizHandler = function() {};
      quiz.disconnectedCallback();
      window.removeEventListener = originalRemove;
      return listenerRemoved;
    });
    expect(result).toBe(true);
  });

  test('should remove quiz-results event listener', async () => {
    const result = await page.evaluate(() => {
      let listenerRemoved = false;
      const originalRemove = window.removeEventListener;
      window.removeEventListener = function(type) {
        if (type === 'quiz-results') listenerRemoved = true;
      };
      const quiz = document.createElement('course-quiz');
      quiz._boundQuizResults = function() {};
      quiz.disconnectedCallback();
      window.removeEventListener = originalRemove;
      return listenerRemoved;
    });
    expect(result).toBe(true);
  });

  test('should call super.disconnectedCallback()', async () => {
    const result = await page.evaluate(() => {
      let superCalled = false;
      const originalSuper = CourseComponent.prototype.disconnectedCallback;
      CourseComponent.prototype.disconnectedCallback = function() {
        superCalled = true;
        return originalSuper.apply(this, arguments);
      };
      const quiz = document.createElement('course-quiz');
      quiz._boundQuizHandler = function() {};
      quiz._boundQuizResults = function() {};
      quiz.disconnectedCallback();
      CourseComponent.prototype.disconnectedCallback = originalSuper;
      return superCalled;
    });
    expect(result).toBe(true);
  });
});