const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseQuiz handleQuizData()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should store attemptsLeft from event', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.setAttribute('id', 'quiz1');
      quiz.options = [];
      const event = { detail: { attemptsLeft: 5, questions: [], userAnswers: {} } };
      quiz.handleQuizData(event);
      return quiz.attemptsLeft;
    });
    expect(result).toBe(5);
  });

  test('should store options from event', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      const event = { detail: { options: ['disable-anticheat', 'show-wrong'], questions: [], userAnswers: {} } };
      quiz.handleQuizData(event);
      return quiz.options;
    });
    expect(result).toEqual(['disable-anticheat', 'show-wrong']);
  });

  test('should store hasAttempted flag', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      const event = { detail: { hasAttempted: true, questions: [], userAnswers: {} } };
      quiz.handleQuizData(event);
      return quiz.hasAttempted;
    });
    expect(result).toBe(true);
  });

  test('should filter messages by matching ID', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.setAttribute('id', 'quiz1');
      quiz.options = [];
      const event = { detail: { id: 'quiz2', value: { attemptsLeft: 5, questions: [], userAnswers: {} } } };
      quiz.handleQuizData(event);
      return { attemptsLeft: quiz.attemptsLeft };
    });
    expect(result.attemptsLeft).toBeUndefined();
  });

  test('should process matching ID message', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.setAttribute('id', 'quiz1');
      quiz.options = [];
      const event = { detail: { id: 'quiz1', value: { attemptsLeft: 3, questions: [], userAnswers: {} } } };
      quiz.handleQuizData(event);
      return quiz.attemptsLeft;
    });
    expect(result).toBe(3);
  });
});