const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('send()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/children.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should queue message when pageAPICode is null', async () => {
    const result = await page.evaluate(() => {
      child.pageAPICode = null;
      child.messageQueue = [];

      const originalPostMessage = window.parent.postMessage;
      let postMessageCalled = false;
      window.parent.postMessage = () => {
        postMessageCalled = true;
      };

      try {
        child.send('TEST_SUBJECT', 'TEST_BODY', 'TEST_ID');

        return {
          messageQueued: child.messageQueue.length === 1,
          queuedMessage: child.messageQueue[0],
          messageCorrect:
            child.messageQueue[0][0] === 'TEST_SUBJECT' &&
            child.messageQueue[0][1] === 'TEST_BODY' &&
            child.messageQueue[0][2] === 'TEST_ID',
          postMessageCalled
        };
      } finally {
        window.parent.postMessage = originalPostMessage;
      }
    });

    expect(result.messageQueued).toBe(true);
    expect(result.messageCorrect).toBe(true);
    expect(result.postMessageCalled).toBe(false);
  });

  test('should queue message when pageAPICode is "*"', async () => {
    const result = await page.evaluate(() => {
      child.pageAPICode = "*";
      child.messageQueue = [];

      const originalPostMessage = window.parent.postMessage;
      let postMessageCalled = false;
      window.parent.postMessage = () => {
        postMessageCalled = true;
      };

      try {
        child.send('TEST_SUBJECT', 'TEST_BODY', 'TEST_ID');

        return {
          messageQueued: child.messageQueue.length === 1,
          queuedMessage: child.messageQueue[0],
          messageCorrect:
            child.messageQueue[0][0] === 'TEST_SUBJECT' &&
            child.messageQueue[0][1] === 'TEST_BODY' &&
            child.messageQueue[0][2] === 'TEST_ID',
          postMessageCalled
        };
      } finally {
        window.parent.postMessage = originalPostMessage;
      }
    });

    expect(result.messageQueued).toBe(true);
    expect(result.messageCorrect).toBe(true);
    expect(result.postMessageCalled).toBe(false);
  });

  test('should send message immediately when pageAPICode is set', async () => {
    const result = await page.evaluate(() => {
      child.pageAPICode = 'TEST_API_CODE';
      child.parentOrigin = 'http://parent.origin';
      child.messageQueue = [];

      const originalPostMessage = window.parent.postMessage;
      let postMessageCalled = false;
      let postMessageArgs = null;
      window.parent.postMessage = (...args) => {
        postMessageCalled = true;
        postMessageArgs = args;
      };

      try {
        child.send('TEST_SUBJECT', 'TEST_BODY', 'TEST_ID');

        return {
          messageNotQueued: child.messageQueue.length === 0,
          postMessageCalledOnce: postMessageCalled,
          messageSent:
            postMessageArgs[0] &&
            postMessageArgs[0].type === 'TEST_SUBJECT' &&
            postMessageArgs[0].message === 'TEST_BODY' &&
            postMessageArgs[0].code === 'TEST_API_CODE' &&
            postMessageArgs[0].id === 'TEST_ID' &&
            postMessageArgs[1] === 'http://parent.origin'
        };
      } finally {
        window.parent.postMessage = originalPostMessage;
      }
    });

    expect(result.messageNotQueued).toBe(true);
    expect(result.postMessageCalledOnce).toBe(true);
    expect(result.messageSent).toBe(true);
  });

  test('should not include id in postMessage when id is null', async () => {
    const result = await page.evaluate(() => {
      child.pageAPICode = 'TEST_API_CODE';
      child.parentOrigin = 'http://parent.origin';
      child.messageQueue = [];

      const originalPostMessage = window.parent.postMessage;
      let postMessageArgs = null;
      window.parent.postMessage = (...args) => {
        postMessageArgs = args;
      };

      try {
        child.send('TEST_SUBJECT', 'TEST_BODY', null);

        return {
          messageSent:
            postMessageArgs[0] &&
            postMessageArgs[0].type === 'TEST_SUBJECT' &&
            postMessageArgs[0].message === 'TEST_BODY' &&
            postMessageArgs[0].code === 'TEST_API_CODE' &&
            !('id' in postMessageArgs[0]) &&
            postMessageArgs[1] === 'http://parent.origin'
        };
      } finally {
        window.parent.postMessage = originalPostMessage;
      }
    });

    expect(result.messageSent).toBe(true);
  });

  test('should not include id in postMessage when id is undefined', async () => {
    const result = await page.evaluate(() => {
      child.pageAPICode = 'TEST_API_CODE';
      child.parentOrigin = 'http://parent.origin';
      child.messageQueue = [];

      const originalPostMessage = window.parent.postMessage;
      let postMessageArgs = null;
      window.parent.postMessage = (...args) => {
        postMessageArgs = args;
      };

      try {
        child.send('TEST_SUBJECT', 'TEST_BODY', undefined);

        return {
          idIncluded: 'id' in postMessageArgs[0],
          idValue: postMessageArgs[0].id
        };
      } finally {
        window.parent.postMessage = originalPostMessage;
      }
    });

    expect(result.idIncluded).toBe(false);
    expect(result.idValue).toBe(undefined);
  });
});
