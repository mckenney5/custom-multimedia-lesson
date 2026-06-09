const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseProgramming execute()', () => {
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

  test('should capture stdout from console.log', async () => {
    const result = await page.evaluate(async () => {
      const prog = document.createElement('course-programming');
      prog.connectedCallback();
      prog.editor.setValue('console.log("Hello from test");');
      const out = await prog._sandboxedEval(prog.editor.getValue(), 5000);
      return out;
    });

    expect(result.stdout).toEqual(['Hello from test']);
    expect(result.returnValue).toBeUndefined();
    expect(result.error).toBeNull();
  });

  test('should capture return value', async () => {
    const result = await page.evaluate(async () => {
      const prog = document.createElement('course-programming');
      prog.connectedCallback();
      prog.editor.setValue('42 + 1');
      const out = await prog._sandboxedEval(prog.editor.getValue(), 5000);
      return out;
    });

    expect(result.stdout).toEqual([]);
    expect(result.returnValue).toBe(43);
    expect(result.error).toBeNull();
  });

  test('should catch runtime errors', async () => {
    const result = await page.evaluate(async () => {
      const prog = document.createElement('course-programming');
      prog.connectedCallback();
      prog.editor.setValue('throw new Error("boom");');
      const out = await prog._sandboxedEval(prog.editor.getValue(), 5000);
      return out;
    });

    expect(result.stdout).toEqual([]);
    expect(result.returnValue).toBeUndefined();
    expect(result.error).toContain('boom');
  });

  test('should timeout for long-running code', async () => {
    const result = await page.evaluate(async () => {
      const prog = document.createElement('course-programming');
      prog.connectedCallback();
      prog.editor.setValue('while(true) {}');
      const out = await prog._sandboxedEval(prog.editor.getValue(), 500);
      return out;
    });

    expect(result.stdout).toEqual([]);
    expect(result.returnValue).toBeUndefined();
    expect(result.error).toBe('Execution timed out');
  });

  test('should execute test cases and return testResults', async () => {
    const result = await page.evaluate(async () => {
      const prog = document.createElement('course-programming');
      prog.connectedCallback();
      const code = 'function greet() { return "Hello, World!"; }';
      const testCases = [
        { functionName: "greet", args: [], expected: "Hello, World!" },
      ];
      const out = await prog._sandboxedEval(code, 5000, testCases);
      return JSON.parse(JSON.stringify(out));
    });

    expect(result.stdout).toEqual([]);
    expect(result.error).toBeNull();
    expect(result.testResults).toBeDefined();
    expect(result.testResults.length).toBe(1);
    expect(result.testResults[0].passed).toBe(true);
    expect(result.testResults[0].actual).toBe("Hello, World!");
  });

  test('should mark test case failed on wrong output', async () => {
    const result = await page.evaluate(async () => {
      const prog = document.createElement('course-programming');
      prog.connectedCallback();
      const code = 'function greet() { return "Goodbye"; }';
      const testCases = [
        { functionName: "greet", args: [], expected: "Hello, World!" },
      ];
      const out = await prog._sandboxedEval(code, 5000, testCases);
      return JSON.parse(JSON.stringify(out));
    });

    expect(result.testResults).toBeDefined();
    expect(result.testResults[0].passed).toBe(false);
    expect(result.testResults[0].actual).toBe("Goodbye");
    expect(result.testResults[0].expected).toBe("Hello, World!");
  });

  test('should handle test case with function not defined', async () => {
    const result = await page.evaluate(async () => {
      const prog = document.createElement('course-programming');
      prog.connectedCallback();
      const code = 'var x = 42;';
      const testCases = [
        { functionName: "undefinedFn", args: [], expected: "anything" },
      ];
      const out = await prog._sandboxedEval(code, 5000, testCases);
      return out;
    });

    expect(result.testResults).toBeDefined();
    expect(result.testResults[0].passed).toBe(false);
    expect(result.testResults[0].error).toBeDefined();
  });

  test('should handle multiple test cases', async () => {
    const result = await page.evaluate(async () => {
      const prog = document.createElement('course-programming');
      prog.connectedCallback();
      const code = `
        function add(a, b) { return a + b; }
        function mul(a, b) { return a * b; }
      `;
      const testCases = [
        { functionName: "add", args: [2, 3], expected: 5 },
        { functionName: "mul", args: [2, 3], expected: 6 },
        { functionName: "add", args: [-1, 1], expected: 0 },
      ];
      const out = await prog._sandboxedEval(code, 5000, testCases);
      return out;
    });

    expect(result.testResults.length).toBe(3);
    expect(result.testResults[0].passed).toBe(true);
    expect(result.testResults[1].passed).toBe(true);
    expect(result.testResults[2].passed).toBe(true);
  });

  test('should clean up all event listeners on timeout', async () => {
    const result = await page.evaluate(async () => {
      const prog = document.createElement('course-programming');
      prog.connectedCallback();

      let addCount = 0;
      let removeCount = 0;
      const originalAdd = window.addEventListener;
      const originalRemove = window.removeEventListener;

      window.addEventListener = function(type, handler) {
        if (type === 'message') addCount++;
        return originalAdd.apply(this, arguments);
      };
      window.removeEventListener = function(type, handler) {
        if (type === 'message') removeCount++;
        return originalRemove.apply(this, arguments);
      };

      const out = await prog._sandboxedEval('42', 0);
      // settle: allow any late-arriving SANDBOX_READY to be dispatched
      // before counting listeners (timeout=0 fires cleanup before iframe loads)
      await new Promise(r => setTimeout(r, 50));

      window.addEventListener = originalAdd;
      window.removeEventListener = originalRemove;

      return {
        addCount,
        removeCount,
        listenersCleaned: addCount === removeCount,
        error: out.error,
      };
    });

    expect(result.error).toBe('Execution timed out');
    expect(result.listenersCleaned).toBe(true);
  });
});
