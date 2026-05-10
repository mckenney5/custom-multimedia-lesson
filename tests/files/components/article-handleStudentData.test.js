const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseArticle handleStudentData() (override)', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should update name field in DOM', async () => {
    const result = await page.evaluate(() => {
      const article = document.createElement('course-article');
      article.innerHTML = '<h1>Welcome <span id="name-field"></span></h1>';
      const event = { detail: { name: 'Alice', grade: 'B' } };
      article.handleStudentData(event);
      const nameField = article.querySelector('#name-field');
      return nameField.textContent;
    });
    expect(result).toBe('Alice');
  });

  test('should update grade field in DOM', async () => {
    const result = await page.evaluate(() => {
      const article = document.createElement('course-article');
      article.innerHTML = '<div>Grade: <span id="grade-field"></span></div>';
      const event = { detail: { name: 'Bob', grade: 'A' } };
      article.handleStudentData(event);
      const gradeField = article.querySelector('#grade-field');
      return gradeField.textContent;
    });
    expect(result).toBe('A');
  });

  test('should use Guest when name is missing', async () => {
    const result = await page.evaluate(() => {
      const article = document.createElement('course-article');
      article.innerHTML = '<span id="name-field"></span>';
      const event = { detail: { grade: 'C' } };
      article.handleStudentData(event);
      const nameField = article.querySelector('#name-field');
      return nameField.textContent;
    });
    expect(result).toBe('Guest');
  });

  test('should use N/A when grade is missing', async () => {
    const result = await page.evaluate(() => {
      const article = document.createElement('course-article');
      article.innerHTML = '<span id="grade-field"></span>';
      const event = { detail: { name: 'Test' } };
      article.handleStudentData(event);
      const gradeField = article.querySelector('#grade-field');
      return gradeField.textContent;
    });
    expect(result).toBe('N/A');
  });
});