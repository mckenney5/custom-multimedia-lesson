const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseQuiz renderForm() - Answer Shuffling', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should render answers in different order on repeated calls', async () => {
    const results = await page.evaluate(() => {
      const orders = [];
      for (let i = 0; i < 10; i++) {
        const quiz = document.createElement('course-quiz');
        quiz.options = [];
        quiz.renderForm([{ id: 'q1', type: 'multiple-choice', text: 'Test', possibleAnswers: ['A', 'B', 'C', 'D'] }], {});
        const labels = Array.from(quiz.querySelectorAll('label')).map(l => l.textContent.trim());
        orders.push(labels.join(','));
      }
      return orders;
    });
    const uniqueOrders = new Set(results);
    expect(uniqueOrders.size).toBeGreaterThan(1);
  });

  test('should NOT shuffle when disable-shuffle is set', async () => {
    const results = await page.evaluate(() => {
      const orders = [];
      for (let i = 0; i < 5; i++) {
        const quiz = document.createElement('course-quiz');
        quiz.options = ['disable-shuffle'];
        quiz.renderForm([{ id: 'q1', type: 'multiple-choice', text: 'Test', possibleAnswers: ['A', 'B', 'C', 'D'] }], {});
        const labels = Array.from(quiz.querySelectorAll('label')).map(l => l.textContent.trim());
        orders.push(labels.join(','));
      }
      return orders;
    });
    const uniqueOrders = new Set(results);
    expect(uniqueOrders.size).toBe(1);
    expect(results[0]).toBe('A,B,C,D');
  });

  test('should always include all original options', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.renderForm([{ id: 'q1', type: 'multiple-choice', text: 'Test', possibleAnswers: ['Apple', 'Banana', 'Cherry'] }], {});
      const labels = Array.from(quiz.querySelectorAll('label')).map(l => l.textContent.trim());
      return labels;
    });
    expect(result).toContain('Apple');
    expect(result).toContain('Banana');
    expect(result).toContain('Cherry');
  });
});