const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseQuiz renderForm() - Anti-Cheat', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should include TTS button when anti-cheat enabled', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.renderForm([{ id: 'q1', type: 'multiple-choice', text: 'What is 2+2?', possibleAnswers: ['A', 'B'] }], {});
      const ttsBtn = quiz.querySelector('.tts-btn');
      return ttsBtn !== null;
    });
    expect(result).toBe(true);
  });

  test('should NOT include TTS button when disable-anticheat is set', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = ['disable-anticheat'];
      quiz.renderForm([{ id: 'q1', type: 'multiple-choice', text: 'What is 2+2?', possibleAnswers: ['A', 'B'] }], {});
      const ttsBtn = quiz.querySelector('.tts-btn');
      return ttsBtn;
    });
    expect(result).toBeNull();
  });
});