const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseQuiz handleQuizResults()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should update score field with percentage', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.innerHTML = '<h2><span id="score-field"></span></h2>';
      const event = { detail: { score: 0.75, maxAttempts: 3 } };
      quiz.handleQuizResults(event);
      const scoreField = quiz.querySelector('#score-field');
      return scoreField.textContent;
    });
    expect(result).toBe('75%');
  });

  test('should update max attempts field', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.innerHTML = '<h2><span id="max-attempts-field"></span></h2>';
      const event = { detail: { score: 0.5, maxAttempts: 5 } };
      quiz.handleQuizResults(event);
      const maxField = quiz.querySelector('#max-attempts-field');
      return maxField.textContent;
    });
    expect(result).toBe('5');
  });

  test('should show results div', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.innerHTML = '<div id="results" style="display:none"></div>';
      const event = { detail: { score: 1.0, maxAttempts: 1 } };
      quiz.handleQuizResults(event);
      const resultsDiv = quiz.querySelector('#results');
      return resultsDiv.style.display;
    });
    expect(result).toBe('block');
  });

  test('should filter by ID and ignore non-matching', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.setAttribute('id', 'quiz1');
      const event = { detail: { id: 'quiz2', value: { score: 1.0 } } };
      quiz.handleQuizResults(event);
      const scoreField = quiz.querySelector('#score-field');
      return scoreField ? scoreField.textContent : 'not updated';
    });
    expect(result).toBe('not updated');
  });

  test('should process matching ID results', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.setAttribute('id', 'quiz1');
      quiz.innerHTML = '<h2><span id="score-field"></span></h2>';
      const event = { detail: { id: 'quiz1', value: { score: 0.5, maxAttempts: 2 } } };
      quiz.handleQuizResults(event);
      const scoreField = quiz.querySelector('#score-field');
      return scoreField.textContent;
    });
    expect(result).toBe('50%');
  });
});