const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseProgramming _autograde()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/vendor/codemirror/lib/codemirror.js' });
    await page.addScriptTag({ path: '../src/vendor/codemirror/mode/javascript/javascript.js' });
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('expectedOutput match returns score=1 total=1', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const grade = prog._autograde(
        { expectedOutput: "Hello, World!" },
        ["Hello, World!"],
        undefined,
        null
      );
      return grade;
    });

    expect(result.score).toBe(1);
    expect(result.total).toBe(1);
    expect(result.results[0].passed).toBe(true);
  });

  test('expectedOutput mismatch returns score=0', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const grade = prog._autograde(
        { expectedOutput: "Hello, World!" },
        ["Goodbye"],
        undefined,
        null
      );
      return grade;
    });

    expect(result.score).toBe(0);
    expect(result.total).toBe(1);
    expect(result.results[0].passed).toBe(false);
  });

  test('no config means no autograde', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const grade = prog._autograde({}, ["Hello"], undefined, null);
      return grade;
    });

    expect(result.score).toBe(0);
    expect(result.total).toBe(0);
    expect(result.results).toEqual([]);
  });

  test('error causes expectedOutput to fail', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const grade = prog._autograde(
        { expectedOutput: "Hello" },
        [],
        undefined,
        "Something broke"
      );
      return grade;
    });

    expect(result.score).toBe(0);
    expect(result.results[0].passed).toBe(false);
  });
});
