const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.handleMessage: nonce stress tests", () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("burst of 500 valid unique nonces should all be processed", async () => {
    const result = await page.evaluate(() => {
      if (typeof state === "undefined") return { error: "state not defined" };

      state.pageAPISecret = "STRESS_SECRET";
      state._seenNonces.clear();

      const rejectedNonces = [];
      const originalPostMessage =
        state.lessonFrame.contentWindow.postMessage;
      state.lessonFrame.contentWindow.postMessage = (...args) => {
        if (args[0] && args[0].type === "NONCE_REJECTED") {
          rejectedNonces.push(args[0].nonce);
        }
      };

      const COUNT = 500;
      const base = Date.now() - COUNT;
      for (let i = 0; i < COUNT; i++) {
        const message = {
          data: {
            type: "QUIZ_RESULT",
            message: {
              id: "test-quiz",
              value: { score: 10, answers: {} }
            },
            code: "STRESS_SECRET",
            nonce: base + i
          },
          origin: window.location.origin
        };
        state.handleMessage(message);
      }

      state.lessonFrame.contentWindow.postMessage = originalPostMessage;

      return {
        seenSize: state._seenNonces.size,
        rejectedCount: rejectedNonces.length,
        rejectedNonces,
        firstNonce: base,
        lastNonce: base + COUNT - 1
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.rejectedCount).toBe(0);
    expect(result.seenSize).toBe(500);
  });

  test("interleaved valid and invalid messages should route correctly", async () => {
    const result = await page.evaluate(() => {
      if (typeof state === "undefined") return { error: "state not defined" };

      state.pageAPISecret = "INTERLEAVE_SECRET";

      const results = [];
      let nonceRejectedCount = 0;
      let originResponseCount = 0;
      const originalPostMessage =
        state.lessonFrame.contentWindow.postMessage;
      state.lessonFrame.contentWindow.postMessage = (...args) => {
        if (args[0] && args[0].type === "NONCE_REJECTED") {
          nonceRejectedCount++;
        }
        if (args[0] && args[0].type === "ORIGIN") {
          originResponseCount++;
        }
      };

      const now = Date.now();

      const scenarios = [
        { label: "valid nonce", msg: { type: "SEND_META", message: {}, code: "INTERLEAVE_SECRET", nonce: now - 1 } },
        { label: "missing nonce", msg: { type: "SEND_META", message: {}, code: "INTERLEAVE_SECRET" } },
        { label: "valid nonce 2", msg: { type: "SEND_META", message: {}, code: "INTERLEAVE_SECRET", nonce: now - 2 } },
        { label: "expired nonce", msg: { type: "SEND_META", message: {}, code: "INTERLEAVE_SECRET", nonce: now - 301000 } },
        { label: "ORIGIN bypass", msg: { type: "ORIGIN", message: window.location.origin, code: "ANY" } },
        { label: "future nonce", msg: { type: "SEND_META", message: {}, code: "INTERLEAVE_SECRET", nonce: now + 60000 } },
        { label: "valid nonce 3", msg: { type: "SEND_META", message: {}, code: "INTERLEAVE_SECRET", nonce: now - 3 } },
        { label: "non-number nonce", msg: { type: "SEND_META", message: {}, code: "INTERLEAVE_SECRET", nonce: "not-a-number" } },
      ];

      let errorLog = [];
      const originalError = console.error;
      console.error = (...args) => errorLog.push(args.join(" "));

      for (const s of scenarios) {
        const beforeCount = nonceRejectedCount;
        const logBefore = errorLog.length;
        state.handleMessage({ data: s.msg, origin: window.location.origin });
        const rejected = nonceRejectedCount > beforeCount;
        const hadError = errorLog.length > logBefore;
        results.push({ label: s.label, rejected, hadError });
      }

      console.error = originalError;
      state.lessonFrame.contentWindow.postMessage = originalPostMessage;

      return {
        results,
        nonceRejectedCount,
        originResponseCount,
        validAccepted: results.filter(r => r.label.startsWith("valid") && !r.rejected).length,
        invalidRejected: results.filter(r => !r.label.startsWith("valid") && !r.label.startsWith("ORIGIN") && r.rejected).length,
        originBypassed: results.filter(r => r.label === "ORIGIN bypass" && !r.rejected).length
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.validAccepted).toBe(3);
    expect(result.invalidRejected).toBe(4);
    expect(result.originBypassed).toBe(1);
  });

  test("_seenNonces should not exceed message count after burst", async () => {
    const result = await page.evaluate(() => {
      if (typeof state === "undefined") return { error: "state not defined" };

      state.pageAPISecret = "MEM_SECRET";
      state._seenNonces.clear();

      const originalPostMessage =
        state.lessonFrame.contentWindow.postMessage;
      state.lessonFrame.contentWindow.postMessage = () => {};

      const BURST = 1000;
      const base = Date.now() - BURST;
      for (let i = 0; i < BURST; i++) {
        const message = {
          data: {
            type: "SEND_META",
            message: {},
            code: "MEM_SECRET",
            nonce: base + i
          },
          origin: window.location.origin
        };
        state.handleMessage(message);
      }

      state.lessonFrame.contentWindow.postMessage = originalPostMessage;

      const finalSize = state._seenNonces.size;

      const errors = [];
      if (finalSize !== BURST) {
        errors.push(`Expected ${BURST} entries, got ${finalSize}`);
      }

      const sampleEntry = state._seenNonces.entries().next();
      if (sampleEntry.done) {
        errors.push("_seenNonces entries iterator is empty");
      }

      return {
        finalSize,
        inBounds: finalSize === BURST,
        errors
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.errors).toEqual([]);
    expect(result.inBounds).toBe(true);
    expect(result.finalSize).toBe(1000);
  });

  test("burst of identical-nonce messages should accept only the first", async () => {
    const result = await page.evaluate(() => {
      if (typeof state === "undefined") return { error: "state not defined" };

      state.pageAPISecret = "DUP_SECRET";
      state._seenNonces.clear();

      const rejectedNonces = [];
      const originalPostMessage =
        state.lessonFrame.contentWindow.postMessage;
      state.lessonFrame.contentWindow.postMessage = (...args) => {
        if (args[0] && args[0].type === "NONCE_REJECTED") {
          rejectedNonces.push(args[0].nonce);
        }
      };

      // Three messages with the same nonce — simulates same-ms component burst
      const sameNonce = Date.now() - 1;
      for (let i = 0; i < 3; i++) {
        const message = {
          data: {
            type: "QUIZ_RESULT",
            message: {
              id: "test-quiz",
              value: { score: 10, answers: {} }
            },
            code: "DUP_SECRET",
            nonce: sameNonce
          },
          origin: window.location.origin
        };
        state.handleMessage(message);
      }

      state.lessonFrame.contentWindow.postMessage = originalPostMessage;

      return {
        seenSize: state._seenNonces.size,
        rejectedCount: rejectedNonces.length,
        firstAccepted: state._seenNonces.has(sameNonce),
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.seenSize).toBe(1);
    expect(result.rejectedCount).toBe(2);
    expect(result.firstAccepted).toBe(true);
  });
});
