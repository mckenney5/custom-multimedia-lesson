const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('pack', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should pack and unpack data correctly', async () => {
    const result = await page.evaluate(async () => {
      await journaler.init();
      journaler._userID = "testUser123";
      journaler._startTime = Date.now() - 10000;

      journaler._eventBuffer = [];
      journaler.log('PAGE_COMPLETE', 5);
      journaler.log('VIDEO_PLAY', 'vid1');

      const deltaArray = [75, 85];
      const packed = await journaler.pack(deltaArray);

      if (typeof packed !== 'string' || packed.length === 0) return false;

      const unpacked = await journaler.unpack(packed);
      if (!unpacked) return false;

      const metaOk = unpacked.meta.version === journaler._version &&
                    unpacked.meta.userID === journaler._userID &&
                    unpacked.meta.startTime === journaler._startTime;

      const deltaOk = Array.isArray(unpacked.delta) &&
                     unpacked.delta.length === 2 &&
                     unpacked.delta[0] === 75 &&
                     unpacked.delta[1] === 85;

      const logOk = Array.isArray(unpacked.log) &&
                    unpacked.log.length === 2;

      return metaOk && deltaOk && logOk;
    });
    expect(result).toBe(true);
  });

  test('should handle empty data in pack/unpack', async () => {
    const result = await page.evaluate(async () => {
      await journaler.init();
      journaler._userID = "testUser456";
      journaler._startTime = Date.now();
      journaler._eventBuffer = [];

      const deltaArray = [];
      const packed = await journaler.pack(deltaArray);

      if (typeof packed !== 'string' || packed.length === 0) return false;

      const unpacked = await journaler.unpack(packed);
      if (!unpacked) return false;

      const metaOk = unpacked.meta.version === journaler._version &&
                    unpacked.meta.userID === journaler._userID &&
                    unpacked.meta.startTime === journaler._startTime;

      const deltaOk = Array.isArray(unpacked.delta) && unpacked.delta.length === 0;
      const logOk = Array.isArray(unpacked.log) && unpacked.log.length === 0;

      return metaOk && deltaOk && logOk;
    });
    expect(result).toBe(true);
  });

  test('should pack with CGZ prefix when compression enabled', async () => {
    const result = await page.evaluate(async () => {
      if (!journaler._supportsCompression) return true;
      journaler.init();
      const packed = await journaler.pack([1,2,3]);
      return typeof packed === 'string' && packed.startsWith('CGZ');
    });
    expect(result).toBe(true);
  });

  test('should pack without prefix when compression disabled', async () => {
    const result = await page.evaluate(async () => {
      const originalSupport = journaler._supportsCompression;
      const originalUse = journaler._useCompression;
      journaler._supportsCompression = false;
      journaler._useCompression = false;
      await journaler.init();
      const packed = await journaler.pack([1,2,3]);
      journaler._supportsCompression = originalSupport;
      journaler._useCompression = originalUse;
      return typeof packed === 'string' && !packed.startsWith('CGZ');
    });
    expect(result).toBe(true);
  });

  test('pack/unpack round-trip should produce consistent getHumanTime after simulated reload', async () => {
    const result = await page.evaluate(async () => {
      await journaler.init();
      // Use a _startTime just before now so the logged offset is 0
      const now = Date.now();
      const fixedStart = now - 10; // 10ms ago, well under 1 second
      journaler._startTime = fixedStart;
      journaler._userID = "userRoundTrip";
      journaler._eventBuffer = [];

      // Log an event — offset will be 0 (< 1000ms)
      journaler.log('COURSE_LOADED', '0');
      const firstPacked = await journaler.pack([1, 2, 3]);
      if (!firstPacked) return false;

      // Simulate reload: stomp _startTime
      journaler._startTime = Date.now();

      // Unpack should restore _startTime
      const unpacked = await journaler.unpack(firstPacked);
      if (!unpacked) return false;

      // After unpack, _startTime must match the original
      if (journaler._startTime !== fixedStart) return false;

      // Verify getHumanTime produces correct wall-clock time for the log entry
      // Log format: "offset,encoded_event,value"
      const firstEntry = unpacked.log[0];
      const offsetStr = firstEntry.split(',')[0];
      const offset = parseInt(offsetStr, 36);

      // offset should be 0 since we logged within 1s of _startTime
      if (offset !== 0) return false;

      // getHumanTime(0) should give the time matching fixedStart
      const humanTime = journaler.getHumanTime(0);

      // Build the expected human-readable time from the original start time
      const pad2 = n => String(n).padStart(2, "0");
      const date = new Date(fixedStart);
      const expected =
        pad2(date.getMonth() + 1) + "/" +
        pad2(date.getDate()) + "/" +
        date.getFullYear() + " " +
        pad2(date.getHours()) + ":" +
        pad2(date.getMinutes()) + ":" +
        pad2(date.getSeconds());

      return humanTime === expected;
    });
    expect(result).toBe(true);
  });
});
