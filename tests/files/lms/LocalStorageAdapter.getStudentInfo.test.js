const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('LocalStorageAdapter.getStudentName() and getStudentID()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should return "Student" for getStudentName', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      return LocalStorageAdapter.getStudentName();
    });
    expect(result).toBe("Student");
  });

  test('should return "0000" for getStudentID', async () => {
    const result = await page.evaluate(() => {
      LocalStorageAdapter.init();
      return LocalStorageAdapter.getStudentID();
    });
    expect(result).toBe("0000");
  });

  test('lms.getStudentName should return "Student" after standalone init', async () => {
    const result = await page.evaluate(() => {
      lms.init("standalone");
      return lms.getStudentName();
    });
    expect(result).toBe("Student");
  });

  test('lms.getStudentID should return "0000" after standalone init', async () => {
    const result = await page.evaluate(() => {
      lms.init("standalone");
      return lms.getStudentID();
    });
    expect(result).toBe("0000");
  });
});
