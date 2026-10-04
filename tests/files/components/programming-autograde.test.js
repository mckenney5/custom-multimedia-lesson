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
    expect(result.results[0].actual).toBe(4);
    expect(result.results[0].expected).toBe(4);
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

  test('internal blank line in expectedOutput does not fail the match', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const grade = prog._autograde(
        { expectedOutput: "Hello\n\nWorld" },
        ["Hello", "World"],
        undefined,
        null
      );
      return grade;
    });

    expect(result.score).toBe(1);
    expect(result.total).toBe(1);
  });

  test('trailing newline in expectedOutput passes', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const grade = prog._autograde(
        { expectedOutput: "Hello\n" },
        ["Hello"],
        undefined,
        null
      );
      return grade;
    });

    expect(result.score).toBe(1);
    expect(result.total).toBe(1);
  });

  test('CRLF line endings in expectedOutput pass', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const grade = prog._autograde(
        { expectedOutput: "Hello\r\nWorld" },
        ["Hello", "World"],
        undefined,
        null
      );
      return grade;
    });

    expect(result.score).toBe(1);
    expect(result.total).toBe(1);
  });

  test('runs of spaces collapse on both sides of the match', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const grade = prog._autograde(
        { expectedOutput: "Hello,   World!" },
        ["Hello,  World!"],
        undefined,
        null
      );
      return grade;
    });

    expect(result.score).toBe(1);
    expect(result.total).toBe(1);
  });

  test('an extra debug log line still fails the match', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const grade = prog._autograde(
        { expectedOutput: "Hello" },
        ["debug info", "Hello"],
        undefined,
        null
      );
      return grade;
    });

    expect(result.score).toBe(0);
    expect(result.total).toBe(1);
    expect(result.results[0].passed).toBe(false);
  });

  test('failed expectedOutput row carries normalized expected and actual', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const grade = prog._autograde(
        { expectedOutput: "Hello\r\nWorld" },
        ["Goodbye"],
        undefined,
        null
      );
      return grade;
    });

    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].expected).toBe("Hello\nWorld");
    expect(result.results[0].actual).toBe("Goodbye");
    expect(result.results[0].error).toBeNull();
  });

  test('expectedOutput row carries the thrown error', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const grade = prog._autograde(
        { expectedOutput: "Hello" },
        [],
        undefined,
        "boom is not a function"
      );
      return grade;
    });

    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].expected).toBe("Hello");
    expect(result.results[0].actual).toBe("");
    expect(result.results[0].error).toBe("boom is not a function");
  });

  test('failed test case rows carry actual, expected and error', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const config = {
        testCases: [
          { label: "Add 2+2", functionName: "add", args: [2, 2], expected: 4 },
          { label: "Throws", functionName: "boom", args: [], expected: "ok" },
        ],
      };
      const sandboxResults = [
        { label: "Add 2+2", passed: false, actual: 5, expected: 4, error: null },
        { label: "Throws", passed: false, actual: undefined, expected: undefined, error: "boom is not a function" },
      ];
      const grade = prog._autograde(config, [], undefined, null, sandboxResults);
      return grade;
    });

    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].actual).toBe(5);
    expect(result.results[0].expected).toBe(4);
    expect(result.results[0].error).toBeNull();
    expect(result.results[1].passed).toBe(false);
    expect(result.results[1].error).toBe("boom is not a function");
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

  test('fallback test case rows carry expected and error when the sandbox never returned results', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const config = {
        testCases: [
          { label: "Greets", functionName: "greet", args: [], expected: "hi" },
          { label: "Adds", functionName: "add", args: [1, 2], expected: 3 },
        ],
      };
      const grade = prog._autograde(config, [], undefined, "Execution timed out");
      return grade;
    });

    expect(result.score).toBe(0);
    expect(result.total).toBe(2);
    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].expected).toBe("hi");
    expect(result.results[0].error).toBe("Execution timed out");
    expect(result.results[0].actual).toBeUndefined();
    expect(result.results[1].expected).toBe(3);
    expect(result.results[1].error).toBe("Execution timed out");
  });

  test('fallback test case rows carry a null error when nothing threw', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const config = {
        testCases: [{ label: "Greets", functionName: "greet", args: [], expected: "hi" }],
      };
      const grade = prog._autograde(config, [], undefined, null);
      return grade;
    });

    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].expected).toBe("hi");
    expect(result.results[0].error).toBeNull();
  });

  test('lone CR line endings in expectedOutput pass', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const grade = prog._autograde(
        { expectedOutput: "Hello\rWorld" },
        ["Hello", "World"],
        undefined,
        null
      );
      return grade;
    });

    expect(result.score).toBe(1);
    expect(result.total).toBe(1);
  });
});
