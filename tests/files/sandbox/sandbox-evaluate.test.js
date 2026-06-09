const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe("sandbox.evaluate()", () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: "../src/internal/sandbox.js" });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("returns result object with stdout, returnValue, error", async () => {
    const result = await page.evaluate(async () => {
      const out = await sandbox.evaluate("1+1");
      return { stdout: out.stdout, returnValue: out.returnValue, error: out.error };
    });

    expect(result).toEqual({
      stdout: [],
      returnValue: 2,
      error: null,
    });
  });

  test("captures console.log output in stdout array", async () => {
    const result = await page.evaluate(async () => {
      const out = await sandbox.evaluate("console.log('hello', 'world');");
      return out.stdout;
    });

    expect(result).toEqual(["hello world"]);
  });

  test("captures runtime errors in error field", async () => {
    const result = await page.evaluate(async () => {
      const out = await sandbox.evaluate("throw new Error('boom');");
      return { error: out.error, stdout: out.stdout, returnValue: out.returnValue };
    });

    expect(result.error).toContain("boom");
    expect(result.stdout).toEqual([]);
    expect(result.returnValue).toBeUndefined();
  });

  test("captures syntax errors in error field", async () => {
    const result = await page.evaluate(async () => {
      const out = await sandbox.evaluate("---");
      return { error: out.error, stdout: out.stdout, returnValue: out.returnValue };
    });

    expect(result.error).toBeTruthy();
    expect(result.stdout).toEqual([]);
    expect(result.returnValue).toBeUndefined();
  });

  test("timeout fires for infinite loop with short timeout", async () => {
    const result = await page.evaluate(async () => {
      const out = await sandbox.evaluate("while(true){}", { timeout: 100 });
      return { error: out.error, stdout: out.stdout };
    });

    expect(result.error).toBe("Execution timed out");
    expect(result.stdout).toEqual([]);
  });

  test("testResults is undefined when no test cases provided", async () => {
    const result = await page.evaluate(async () => {
      const out = await sandbox.evaluate("42");
      return out.testResults;
    });

    expect(result).toBeUndefined();
  });

  test("testResults is populated when test cases provided", async () => {
    const result = await page.evaluate(async () => {
      const out = await sandbox.evaluate(
        "function greet() { return 'Hello, World!'; }",
        { testCases: [{ functionName: "greet", args: [], expected: "Hello, World!" }] }
      );
      return JSON.parse(JSON.stringify(out.testResults));
    });

    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    expect(result[0].passed).toBe(true);
    expect(result[0].actual).toBe("Hello, World!");
  });

  test("handles empty/whitespace code without errors", async () => {
    const result = await page.evaluate(async () => {
      const out = await sandbox.evaluate("");
      return { error: out.error, stdout: out.stdout, returnValue: out.returnValue };
    });

    expect(result.error).toBeNull();
    expect(result.stdout).toEqual([]);
    expect(result.returnValue).toBeUndefined();
  });

  test("no side effects between successive calls", async () => {
    const result = await page.evaluate(async () => {
      const out1 = await sandbox.evaluate("var x = 1; x;");
      const out2 = await sandbox.evaluate("typeof x");
      return { first: out1.returnValue, second: out2.returnValue };
    });

    expect(result.first).toBe(1);
    expect(result.second).toBe("undefined");
  });

  test("removes sandbox iframe from DOM after settle", async () => {
    const result = await page.evaluate(async () => {
      await sandbox.evaluate("42");
      const sandboxIframes = document.querySelectorAll(
        'iframe[sandbox="allow-scripts"]'
      );
      return sandboxIframes.length;
    });

    expect(result).toBe(0);
  });

  test("opts parameter is optional", async () => {
    const result = await page.evaluate(async () => {
      const out = await sandbox.evaluate("1+1");
      return out.returnValue;
    });

    expect(result).toBe(2);
  });
});
