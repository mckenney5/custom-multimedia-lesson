const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('transmit', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should transmit data with correct payload structure', async () => {
    const result = await page.evaluate(async () => {
      journaler._analyticsConfig = {
        enabled: true,
        formURL: 'https://example.com/form',
        fields: { studentID: 'entry.123', submissionType: 'entry.456', telemetryData: 'entry.789' },
        maxPayloadSize: 1000000
      };
      journaler._userID = 'testUser999';

      let lastPayload = null;
      const originalFetch = window.fetch;
      window.fetch = async (url, options) => {
        lastPayload = options.body;
        return new Response('ok', { status: 200 });
      };

      try {
        journaler.transmit('PROGRESS', 'testDataPacket', true);
        if (!lastPayload) return false;
        const params = new URLSearchParams(lastPayload.toString());
        return params.get('entry.123') === 'testUser999' &&
               params.get('entry.456') === 'PROGRESS' &&
               params.get('entry.789') === 'testDataPacket';
      } finally {
        window.fetch = originalFetch;
      }
    });
    expect(result).toBe(true);
  });

  test('should respect priority parameter for keepalive option', async () => {
    const result = await page.evaluate(async () => {
      journaler._analyticsConfig = {
        enabled: true,
        formURL: 'https://example.com/form',
        fields: { studentID: 'entry.123', submissionType: 'entry.456', telemetryData: 'entry.789' },
        maxPayloadSize: 1000000
      };
      journaler._userID = 'testUser999';

      let lastOptions = null;
      const originalFetch = window.fetch;
      window.fetch = async (url, options) => {
        lastOptions = options;
        return new Response('ok', { status: 200 });
      };

      try {
        journaler.transmit('PROGRESS', 'data', true);
        const priorityTrue = lastOptions.keepalive;
        journaler.transmit('PROGRESS', 'data', false);
        const priorityFalse = lastOptions.keepalive;
        return priorityTrue === true && priorityFalse === false;
      } finally {
        window.fetch = originalFetch;
      }
    });
    expect(result).toBe(true);
  });

  test('should not transmit when analytics is disabled or missing', async () => {
    const result = await page.evaluate(async () => {
      let fetchCalled = false;
      const originalFetch = window.fetch;
      window.fetch = async () => { fetchCalled = true; return new Response('ok'); };

      try {
        // Case 1: No config
        journaler._analyticsConfig = null;
        journaler.transmit('PROGRESS', 'data');
        const case1 = !fetchCalled;

        // Case 2: Disabled
        fetchCalled = false;
        journaler._analyticsConfig = { enabled: false };
        journaler.transmit('PROGRESS', 'data');
        const case2 = !fetchCalled;

        return case1 && case2;
      } finally {
        window.fetch = originalFetch;
      }
    });
    expect(result).toBe(true);
  });

  test('should warn when payload exceeds 90% of max size', async () => {
    const result = await page.evaluate(async () => {
      journaler._analyticsConfig = {
        enabled: true,
        formURL: 'https://example.com/form',
        fields: { studentID: 'entry.123', submissionType: 'entry.456', telemetryData: 'entry.789' },
        maxPayloadSize: 50
      };
      journaler._userID = 'testUser';

      let warnCalled = false;
      const originalWarn = console.warn;
      console.warn = (...args) => { warnCalled = true; originalWarn(...args); };

      try {
        journaler.transmit('PROGRESS', 'x'.repeat(100));
        return warnCalled;
      } finally {
        console.warn = originalWarn;
      }
    });
    expect(result).toBe(true);
  });

  test('should handle transmission success and failure', async () => {
    const result = await page.evaluate(async () => {
      journaler._analyticsConfig = {
        enabled: true,
        formURL: 'https://example.com/form',
        fields: { studentID: 'entry.123', submissionType: 'entry.456', telemetryData: 'entry.789' },
        maxPayloadSize: 1000000
      };
      journaler._userID = 'testUser';

      let errorCalled = false;
      const originalError = console.error;
      console.error = (...args) => { errorCalled = true; originalError(...args); };

      const originalFetch = window.fetch;
      window.fetch = async () => { throw new Error('Network error'); };

      try {
        journaler.transmit('PROGRESS', 'failureData');
        await new Promise(resolve => setTimeout(resolve, 0));
        return errorCalled;
      } finally {
        console.error = originalError;
        window.fetch = originalFetch;
      }
    });
    expect(result).toBe(true);
  });
});
