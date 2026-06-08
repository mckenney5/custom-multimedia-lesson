const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseProgramming render()', () => {
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

  test('should create a CodeMirror editor on render', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      prog.setAttribute('id', 'prog1');
      prog.connectedCallback();
      return {
        hasEditor: prog.editor instanceof CodeMirror,
        editorValue: prog.editor.getValue(),
        hasRunBtn: !!prog.querySelector('#prog-btn-run'),
        hasResetBtn: !!prog.querySelector('#prog-btn-reset'),
        hasOutput: !!prog.querySelector('#prog-output'),
      };
    });

    expect(result.hasEditor).toBe(true);
    expect(result.hasRunBtn).toBe(true);
    expect(result.hasResetBtn).toBe(true);
    expect(result.hasOutput).toBe(true);
  });

  test('should set CodeMirror mode from language attribute', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      prog.setAttribute('language', 'javascript');
      prog.connectedCallback();
      return prog.editor.getOption('mode');
    });

    expect(result).toBe('javascript');
  });

  test('should pre-populate starter code from _componentConfig', async () => {
    const result = await page.evaluate(() => {
      const prog = document.createElement('course-programming');
      prog._componentConfig = { starterCode: 'console.log("hello");' };
      prog.connectedCallback();
      return prog.editor.getValue();
    });

    expect(result).toBe('console.log("hello");');
  });
});
