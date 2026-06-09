const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseProgramming._validateCode', () => {
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

  test('should reject code matching a banned regex pattern', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const config = {
        bannedPatterns: ['console\\.log\\s*\\(\\s*16\\s*\\)'],
      };
      return prog._validateCode('console.log(16);', config);
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('banned pattern');
  });

  test('should accept code that does not match any banned pattern', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const config = {
        bannedPatterns: ['console\\.log\\s*\\(\\s*16\\s*\\)'],
      };
      return prog._validateCode('console.log(42);', config);
    });

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  test('should fall back to substring match for invalid regex', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const config = {
        bannedPatterns: ['[invalid'],
      };
      return prog._validateCode('some [invalid pattern here', config);
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('banned pattern');
  });

  test('should not block code when invalid regex substring is not present', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      const config = {
        bannedPatterns: ['[invalid'],
      };
      return prog._validateCode('clean code here', config);
    });

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  test('should pass validation when bannedPatterns is undefined', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      return prog._validateCode('var x = 1;', {});
    });

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  test('should pass validation when bannedPatterns is empty array', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      return prog._validateCode('var x = 1;', { bannedPatterns: [] });
    });

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  test('should reject code with banned substring via execute flow', async () => {
    const result = await page.evaluate(async () => {
      const prog = document.createElement('course-programming');

      const sendCalls = [];
      prog.send = (type, data) => {
        if (type === 'CODE_EXECUTION') sendCalls.push({ type, data });
      };

      prog._componentConfig = {
        bannedPatterns: ['evil_code'],
        timeout: 5000,
      };
      prog.connectedCallback();
      prog.editor.setValue('evil_code();');

      await prog.execute();

      const outputText = prog.querySelector('#prog-output-text').textContent;

      return {
        outputText,
        sendCall: sendCalls[0],
        sendCount: sendCalls.length,
      };
    });

    expect(result.outputText).toContain('banned pattern');
    expect(result.sendCount).toBe(1);
    expect(result.sendCall.type).toBe('CODE_EXECUTION');
    expect(result.sendCall.data.error).toContain('banned pattern');
    expect(result.sendCall.data.score).toBe(0);
    expect(result.sendCall.data.completed).toBe(false);
  });
});
