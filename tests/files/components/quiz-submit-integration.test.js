const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseQuiz submit() - DOM Integration', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should calculate correct score using real DOM input', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.innerHTML = `
        <div class="quiz-container">
          <fieldset class="question-block">
            <legend>1. What is 2+2?</legend>
            <input type="text" name="q1" id="q1_text" value="4">
          </fieldset>
          <button class="btn-submit">Submit Answers</button>
        </div>
      `;
      const questions = [{ id: 'q1', type: 'short-answer', text: 'What is 2+2?', correctAnswers: ['4'], pointValue: 10 }];
      quiz.submit(questions);
      return { score: quiz.score, maxScore: quiz.maxScore };
    });
    expect(result.score).toBe(10);
    expect(result.maxScore).toBe(10);
  });

  test('should calculate incorrect when answer wrong', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.innerHTML = `<input type="text" name="q1" id="q1_text" value="5">`;
      const questions = [{ id: 'q1', type: 'short-answer', correctAnswers: ['4'], pointValue: 10 }];
      quiz.submit(questions);
      return { score: quiz.score };
    });
    expect(result.score).toBe(0);
  });

  test('should grade multiple choice with radio buttons', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.innerHTML = `
        <label><input type="radio" name="q1" value="A" checked> A</label>
        <label><input type="radio" name="q1" value="B"> B</label>
      `;
      const questions = [{ id: 'q1', type: 'multiple-choice', correctAnswers: ['A'], pointValue: 10 }];
      quiz.submit(questions);
      return { score: quiz.score };
    });
    expect(result.score).toBe(10);
  });

  test('should grade select-all with checkboxes', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.innerHTML = `
        <label><input type="checkbox" name="q1" value="A" checked> A</label>
        <label><input type="checkbox" name="q1" value="B" checked> B</label>
        <label><input type="checkbox" name="q1" value="C"> C</label>
      `;
      const questions = [{ id: 'q1', type: 'select-all-that-apply', correctAnswers: ['A', 'B'], pointValue: 20 }];
      quiz.submit(questions);
      return { score: quiz.score, maxScore: quiz.maxScore };
    });
    expect(result.score).toBe(20);
    expect(result.maxScore).toBe(20);
  });

  test('should handle whitespace in answers', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.innerHTML = `<input type="text" name="q1" id="q1_text" value=" 4 ">`;
      const questions = [{ id: 'q1', type: 'short-answer', correctAnswers: ['4'], pointValue: 10 }];
      quiz.submit(questions);
      return quiz.score;
    });
    expect(result).toBe(10);
  });

  test('should update UI with score after submit', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.innerHTML = `
        <h2>Score: <span id="score-field"></span></h2>
        <div id="results" style="display:none"></div>
        <input type="radio" name="q1" value="A" checked>
      `;
      const questions = [{ id: 'q1', type: 'multiple-choice', correctAnswers: ['A'], pointValue: 10 }];
      quiz.submit(questions);
      const scoreField = quiz.querySelector('#score-field');
      const resultsDiv = quiz.querySelector('#results');
      return { scoreText: scoreField.textContent, resultsVisible: resultsDiv.style.display };
    });
    expect(result.scoreText).toBe('100%');
    expect(result.resultsVisible).toBe('block');
  });

  test('should decrement attempts', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.attemptsLeft = 3;
      quiz.innerHTML = `<input type="radio" name="q1" value="A" checked>`;
      const questions = [{ id: 'q1', type: 'multiple-choice', correctAnswers: ['A'], pointValue: 10 }];
      quiz.submit(questions);
      return quiz.attemptsLeft;
    });
    expect(result).toBe(2);
  });

  test('should disable submit button and change text to Submitted', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.innerHTML = `
        <button class="btn-submit">Submit Answers</button>
        <input type="radio" name="q1" value="A" checked>
      `;
      const questions = [{ id: 'q1', type: 'multiple-choice', correctAnswers: ['A'], pointValue: 10 }];
      quiz.submit(questions);
      const btn = quiz.querySelector('.btn-submit');
      return { disabled: btn.disabled, text: btn.textContent };
    });
    expect(result.disabled).toBe(true);
    expect(result.text).toBe('Submitted');
  });

  test('should send QUIZ_RESULT with score, maxScore, and answers', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.innerHTML = `<input type="radio" name="q1" value="A" checked>`;
      let sendType = null;
      let sendPayload = null;
      quiz.send = function(type, payload) {
        sendType = type;
        sendPayload = payload;
      };
      const questions = [{ id: 'q1', type: 'multiple-choice', correctAnswers: ['A'], pointValue: 10 }];
      quiz.submit(questions);
      return { sendType, sendPayload };
    });
    expect(result.sendType).toBe('QUIZ_RESULT');
    expect(result.sendPayload.score).toBe(10);
    expect(result.sendPayload.maxScore).toBe(10);
    expect(result.sendPayload.answers).toEqual({ q1: ['A'] });
  });
});