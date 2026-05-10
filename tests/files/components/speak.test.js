const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseComponent speak() method', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should warn when speechSynthesis is not supported', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      const warnMessages = [];
      const originalWarn = console.warn;
      console.warn = function(msg) { warnMessages.push(msg); };
      const originalSpeech = window.speechSynthesis;
      delete window.speechSynthesis;
      video.speak('test text');
      window.speechSynthesis = originalSpeech;
      console.warn = originalWarn;
      return warnMessages;
    });
    expect(result[0]).toContain('Text-to-Speech not supported');
  });

  test('should cancel current speech before speaking new text', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      let cancelCalled = false;
      const originalCancel = window.speechSynthesis.cancel;
      window.speechSynthesis.cancel = function() { cancelCalled = true; };
      window.speechSynthesis.speak = function() {};
      video.speak('new text');
      window.speechSynthesis.cancel = originalCancel;
      return cancelCalled;
    });
    expect(result).toBe(true);
  });

  test('should silence when clicking same button twice', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      let speakCallCount = 0;
      window.speechSynthesis.speak = function() { speakCallCount++; };
      video.speak('same text');
      video.speak('same text');
      return { speakCallCount: speakCallCount, lastSpeech: video._lastSpeech };
    });
    expect(result.speakCallCount).toBe(1);
    expect(result.lastSpeech).toBe(null);
  });

  test('should speak different text successfully', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      let speakCalled = false;
      let utteranceText = null;
      window.speechSynthesis.speak = function(utterance) {
        speakCalled = true;
        utteranceText = utterance.text;
      };
      const spoke = video.speak('hello world');
      return { speakCalled: speakCalled, utteranceText: utteranceText };
    });
    expect(result.speakCalled).toBe(true);
    expect(result.utteranceText).toBe('hello world');
  });

  test('should set onend callback to clear _lastSpeech', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      let callbackSet = false;
      window.speechSynthesis.speak = function(utterance) {
        callbackSet = typeof utterance.onend === 'function';
        utterance.onend();
      };
      video.speak('test');
      return { callbackSet: callbackSet, clearedAfterEnd: video._lastSpeech === null };
    });
    expect(result.callbackSet).toBe(true);
    expect(result.clearedAfterEnd).toBe(true);
  });
});