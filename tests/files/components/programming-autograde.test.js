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

  test('testCases with sandboxTestResults reports correct scores', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const config = {
        testCases: [
          { label: "Add 2+2", functionName: "add", args: [2, 2], expected: 4 },
          { label: "Mul 3*3", functionName: "mul", args: [3, 3], expected: 9 },
        ],
      };
      const sandboxResults = [
        { label: "Add 2+2", passed: true, actual: 4, expected: 4, error: null },
        { label: "Mul 3*3", passed: false, actual: 6, expected: 9, error: null },
      ];
      const grade = prog._autograde(config, [], undefined, null, sandboxResults);
      return grade;
    });

    expect(result.score).toBe(1);
    expect(result.total).toBe(2);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[1].passed).toBe(false);
  });

  test('testCases with sandboxTestResults merges with expectedOutput', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const config = {
        expectedOutput: "Hello",
        testCases: [
          { label: "Greet", functionName: "greet", args: [], expected: "Hi" },
        ],
      };
      const sandboxResults = [
        { label: "Greet", passed: true, actual: "Hi", expected: "Hi", error: null },
      ];
      const grade = prog._autograde(config, ["Hello"], undefined, null, sandboxResults);
      return grade;
    });

    expect(result.score).toBe(2);
    expect(result.total).toBe(2);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].label).toBe("Output matches expected");
    expect(result.results[1].passed).toBe(true);
  });

  test('testCases without sandboxTestResults marks all as not passed', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const config = {
        testCases: [
          { label: "TC1" },
          { label: "TC2" },
        ],
      };
      const grade = prog._autograde(config, [], undefined, null);
      return grade;
    });

    expect(result.score).toBe(0);
    expect(result.total).toBe(2);
    expect(result.results[0].passed).toBe(false);
    expect(result.results[1].passed).toBe(false);
  });
});
