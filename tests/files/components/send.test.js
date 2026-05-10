const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseComponent send()', () => {
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

  test('should call window.child.send when available', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element (which extends CourseComponent)
      const video = document.createElement('course-video');
      video.setAttribute('id', 'test-id');
      
      // Track if window.child.send was called
      let sendCalled = false;
      let sendType = null;
      let sendPayload = null;
      
      // Mock window.child.send
      window.child = {
        send: function(type, payload) {
          sendCalled = true;
          sendType = type;
          sendPayload = payload;
        }
      };
      
      // Call send method
      video.send('TEST_TYPE', 'test-message');
      
      // Return what was captured
      return {
        sendCalled: sendCalled,
        sendType: sendType,
        sendPayload: sendPayload
      };
    });

    expect(result.sendCalled).toBe(true);
    expect(result.sendType).toBe('TEST_TYPE');
    expect(result.sendPayload).toEqual({ id: 'test-id', value: 'test-message' });
  });

  test('should send raw message when no id attribute is set', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      let sendType = null;
      let sendPayload = null;
      window.child = {
        send: function(type, payload) {
          sendType = type;
          sendPayload = payload;
        }
      };
      video.send('RAW_TYPE', 'unwrapped-message');
      return { sendType, sendPayload };
    });
    expect(result.sendType).toBe('RAW_TYPE');
    expect(result.sendPayload).toBe('unwrapped-message');
  });

  test('should log warning when window.child.send is not available', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element (which extends CourseComponent)
      const video = document.createElement('course-video');
      
      // Ensure window.child is not available
      delete window.child;
      
      // Capture console.warn output
      const warnMessages = [];
      const originalWarn = console.warn;
      console.warn = function(message) {
        warnMessages.push(message);
        originalWarn.apply(console, arguments);
      };
      
      // Call send method
      video.send('TEST_TYPE', 'test-message');
      
      // Restore console.warn
      console.warn = originalWarn;
      
      // Return warning messages
      return warnMessages;
    });

    expect(result.length).toBe(1);
    expect(result[0]).toContain('[COURSE-VIDEO] Cannot send message.');
  });
});