const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseQuiz renderForm() - Feedback Options', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should show correct/incorrect feedback when show-wrong and has attempted', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = ['show-wrong'];
      quiz.hasAttempted = true;
      quiz.renderForm(
        [{ id: 'q1', type: 'multiple-choice', text: 'Test', possibleAnswers: ['A'], correctAnswers: ['A'] }],
        { q1: ['A'] }
      );
      const feedback = quiz.querySelector('.question-block');
      return feedback.innerHTML;
    });
    expect(result).toContain('Correct');
  });

  test('should show incorrect feedback when wrong answer', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = ['show-wrong'];
      quiz.hasAttempted = true;
      quiz.renderForm(
        [{ id: 'q1', type: 'multiple-choice', text: 'Test', possibleAnswers: ['A', 'B'], correctAnswers: ['A'] }],
        { q1: ['B'] }
      );
      return quiz.querySelector('.question-block').innerHTML;
    });
    expect(result).toContain('Incorrect');
  });

  test('should NOT show feedback when hasAttempted is false', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = ['show-wrong'];
      quiz.hasAttempted = false;
      quiz.renderForm(
        [{ id: 'q1', type: 'multiple-choice', text: 'Test', possibleAnswers: ['A'], correctAnswers: ['A'] }],
        { q1: ['A'] }
      );
      return quiz.querySelector('.question-block').innerHTML;
    });
    expect(result).not.toContain('Correct');
    expect(result).not.toContain('Incorrect');
  });

  test('should show correct answer when show-answer and out of attempts', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = ['show-answer'];
      quiz.attemptsLeft = 0;
      quiz.renderForm(
        [{ id: 'q1', type: 'multiple-choice', text: 'Test', possibleAnswers: ['A', 'B'], correctAnswers: ['A'] }],
        {}
      );
      return quiz.querySelector('.question-block').innerHTML;
    });
    expect(result).toContain('Correct Answer');
  });

  test('should NOT show answer when attempts remain', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = ['show-answer'];
      quiz.attemptsLeft = 1;
      quiz.renderForm(
        [{ id: 'q1', type: 'multiple-choice', text: 'Test', possibleAnswers: ['A'], correctAnswers: ['A'] }],
        {}
      );
      return quiz.querySelector('.question-block').innerHTML;
    });
    expect(result).not.toContain('Correct Answer');
  });
});