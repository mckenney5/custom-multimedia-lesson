const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("CourseProgramming execute() wiring", () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: "../src/vendor/codemirror/lib/codemirror.js" });
    await page.addScriptTag({ path: "../src/vendor/codemirror/mode/javascript/javascript.js" });
    await page.addScriptTag({ path: "../src/internal/sandbox.js" });
    await page.addScriptTag({ path: "../src/internal/components.js" });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("execute() calls sandbox.evaluate and returns result via send", async () => {
    const result = await page.evaluate(async () => {
      const prog = document.createElement("course-programming");
      prog.connectedCallback();
      prog._componentConfig = { timeout: 5000 };
      prog.editor.setValue("42 + 1");
      const sendPromise = new Promise((resolve) => {
        const orig = prog.send;
        prog.send = function (type, data) {
          orig.call(this, type, data);
          resolve(data);
        };
      });
      await prog.execute();
      return sendPromise;
    });

    expect(result.code).toBe("42 + 1");
    expect(result.returnValue).toBe(43);
    expect(result.error).toBeNull();
    expect(result.stdout).toEqual([]);
  });
});
