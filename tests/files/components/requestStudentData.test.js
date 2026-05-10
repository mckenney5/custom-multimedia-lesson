const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseComponent requestStudentData()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    // Load components.js for this test
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should call send with GET_STUDENT_DATA and empty string', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element (which extends CourseComponent)
      const video = document.createElement('course-video');
      
      // Mock the send method to track calls
      const originalSend = video.send;
      let calledWithType = null;
      let calledWithMessage = null;
      
      video.send = function(type, message) {
        calledWithType = type;
        calledWithMessage = message;
        // Call original send to avoid breaking other functionality
        return originalSend.call(this, type, message);
      };
      
      // Call requestStudentData
      video.requestStudentData();
      
      // Check if send was called with correct arguments
      return {
        type: calledWithType,
        message: calledWithMessage
      };
    });

    expect(result.type).toBe('GET_STUDENT_DATA');
    expect(result.message).toBe('');
  });
});