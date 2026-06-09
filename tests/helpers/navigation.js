const { expect } = require("@playwright/test");

async function setProgrammingCode(iframe, id, code) {
  await iframe.locator(`course-programming#${id}`).evaluate((el, c) => {
    return new Promise(resolve => {
      const wait = () => {
        if (el._componentConfig) {
          el.editor.setValue(c);
          resolve();
        } else {
          setTimeout(wait, 50);
        }
      };
      wait();
    });
  }, code);
}

async function runProgrammingCode(iframe, id) {
  await iframe.locator(`course-programming#${id} .prog-btn-run`).click();
}

async function assertProgrammingResult(iframe, id, resultClass) {
  await expect(
    iframe.locator(`course-programming#${id} .prog-test-result.${resultClass}`).first(),
  ).toBeVisible({ timeout: 10000 });
}

async function completeProgrammingExercises(iframe) {
  await setProgrammingCode(
    iframe,
    "prog_hello",
    'function greet() { return "Hello, World!"; }\n\nconsole.log(greet());',
  );
  await runProgrammingCode(iframe, "prog_hello");
  await assertProgrammingResult(iframe, "prog_hello", "passed");

  await setProgrammingCode(
    iframe,
    "prog_double",
    'function double_value(n) { return n * n; }\n\nconsole.log(double_value(4));',
  );
  await runProgrammingCode(iframe, "prog_double");
  await assertProgrammingResult(iframe, "prog_double", "passed");
}

module.exports = {
  setProgrammingCode,
  runProgrammingCode,
  assertProgrammingResult,
  completeProgrammingExercises,
};
