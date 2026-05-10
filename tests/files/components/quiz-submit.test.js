const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseQuiz submit()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should calculate correct score for short answer matching', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.innerHTML = '';
      const questions = [
        { id: 'q1', type: 'short-answer', text: 'What is 2+2?', correctAnswers: ['4'], pointValue: 10 }
      ];
      quiz.input = document.createElement('input');
      quiz.input.name = 'q1';
      quiz.input.value = '4';
      quiz.querySelector = function(sel) {
        if (sel === 'input[name="q1"]') return quiz.input;
        return null;
      };
      quiz.querySelectorAll = function(sel) { return []; };
      quiz.send = function() {};
      quiz.submit(questions);
      return { score: quiz.score, maxScore: quiz.maxScore };
    });
    expect(result.score).toBe(10);
    expect(result.maxScore).toBe(10);
  });

  test('should calculate incorrect for wrong short answer', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      const questions = [
        { id: 'q1', type: 'short-answer', text: 'What is 2+2?', correctAnswers: ['4'], pointValue: 10 }
      ];
      quiz.input = document.createElement('input');
      quiz.input.name = 'q1';
      quiz.input.value = '5';
      quiz.querySelector = function(sel) {
        if (sel === 'input[name="q1"]') return quiz.input;
        return null;
      };
      quiz.querySelectorAll = function(sel) { return []; };
      quiz.send = function() {};
      quiz.submit(questions);
      return { score: quiz.score, maxScore: quiz.maxScore };
    });
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(10);
  });

  test('should calculate correct for exact match radio choice', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      const questions = [
        { id: 'q1', type: 'multiple-choice', text: 'Choose A', correctAnswers: ['A'], pointValue: 10 }
      ];
      quiz.inputs = [{ value: 'A', checked: true }];
      quiz.querySelector = function() { return null; };
      quiz.querySelectorAll = function() { return quiz.inputs; };
      quiz.send = function() {};
      quiz.submit(questions);
      return { score: quiz.score, maxScore: quiz.maxScore };
    });
    expect(result.score).toBe(10);
    expect(result.maxScore).toBe(10);
  });

  test('should calculate correct for exact match select-all', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      const questions = [
        { id: 'q1', type: 'select-all-that-apply', text: 'Choose A and B', correctAnswers: ['A', 'B'], pointValue: 20 }
      ];
      quiz.inputs = [{ value: 'A', checked: true }, { value: 'B', checked: true }];
      quiz.querySelector = function() { return null; };
      quiz.querySelectorAll = function() { return quiz.inputs; };
      quiz.send = function() {};
      quiz.submit(questions);
      return { score: quiz.score, maxScore: quiz.maxScore };
    });
    expect(result.score).toBe(20);
    expect(result.maxScore).toBe(20);
  });

  test('should decrement attempts left', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.attemptsLeft = 3;
      const questions = [{ id: 'q1', type: 'multiple-choice', correctAnswers: ['A'], pointValue: 10 }];
      quiz.querySelector = function() { return null; };
      quiz.querySelectorAll = function() { return []; };
      quiz.send = function() {};
      quiz.submit(questions);
      return quiz.attemptsLeft;
    });
    expect(result).toBe(2);
  });
});