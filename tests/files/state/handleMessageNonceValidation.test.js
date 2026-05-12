const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.handleMessage: nonce validation", () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("should reject message with no nonce field", async () => {
    const result = await page.evaluate(() => {
      if (typeof state === "undefined") return { error: "state not defined" };

      state.pageAPISecret = "VALID_SECRET_12345";

      const errorLog = [];
      const originalError = console.error;
      console.error = (...args) => errorLog.push(args.join(" "));

      let nonceRejectedSent = false;
      let nonceRejectedArgs = null;
      const originalPostMessage =
        state.lessonFrame.contentWindow.postMessage;
      state.lessonFrame.contentWindow.postMessage = (...args) => {
        if (args[0] && args[0].type === "NONCE_REJECTED") {
          nonceRejectedSent = true;
          nonceRejectedArgs = args[0];
        }
      };

      const message = {
        data: {
          type: "QUIZ_RESULT",
          message: {
            id: "test-quiz",
            value: { score: 10, answers: {} }
          },
          code: "VALID_SECRET_12345"
        },
        origin: window.location.origin
      };

      state.handleMessage(message);

      console.error = originalError;
      state.lessonFrame.contentWindow.postMessage = originalPostMessage;

      return {
        errorLogged: errorLog.length > 0,
		hasNonceError: errorLog.some(e => e.includes("Invalid or expired nonce")),
		nonceRejectedSent
	};
});

expect(result.error).toBeUndefined();
expect(result.errorLogged).toBe(true);
expect(result.hasNonceError).toBe(true);
expect(result.nonceRejectedSent).toBe(true);
});

test("should process message with valid recent nonce", async () => {
    const result = await page.evaluate(() => {
      if (typeof state === "undefined") return { error: "state not defined" };

      state.pageAPISecret = "VALID_SECRET_12345";

      const errorLog = [];
      const originalError = console.error;
      console.error = (...args) => errorLog.push(args.join(" "));

      const message = {
        data: {
          type: "QUIZ_RESULT",
          message: {
            id: "test-quiz",
            value: { score: 10, answers: {} }
          },
          code: "VALID_SECRET_12345",
          nonce: Date.now()
        },
        origin: window.location.origin
      };

      state.handleMessage(message);

      console.error = originalError;

      return {
        errorLogged: errorLog.length > 0,
        hasNonceError: errorLog.some(e => e.includes("Invalid or expired nonce"))
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.errorLogged).toBe(false);
    expect(result.hasNonceError).toBe(false);
  });

  test("should reject message with non-number nonce type", async () => {
    const result = await page.evaluate(() => {
      if (typeof state === "undefined") return { error: "state not defined" };

      state.pageAPISecret = "VALID_SECRET_12345";

      const errorLog = [];
      const originalError = console.error;
      console.error = (...args) => errorLog.push(args.join(" "));

      let nonceRejectedSent = false;
      const originalPostMessage =
        state.lessonFrame.contentWindow.postMessage;
      state.lessonFrame.contentWindow.postMessage = (...args) => {
        if (args[0] && args[0].type === "NONCE_REJECTED") {
          nonceRejectedSent = true;
        }
      };

      const message = {
        data: {
          type: "QUIZ_RESULT",
          message: {
            id: "test-quiz",
            value: { score: 10, answers: {} }
          },
          code: "VALID_SECRET_12345",
          nonce: "not-a-number"
        },
        origin: window.location.origin
      };

      state.handleMessage(message);

      console.error = originalError;
      state.lessonFrame.contentWindow.postMessage = originalPostMessage;

      return {
        errorLogged: errorLog.length > 0,
        hasNonceError: errorLog.some(e => e.includes("Invalid or expired nonce")),
        nonceRejectedSent
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.errorLogged).toBe(true);
    expect(result.hasNonceError).toBe(true);
    expect(result.nonceRejectedSent).toBe(true);
  });

  test("should reject message with expired nonce older than 5 minutes", async () => {
    const result = await page.evaluate(() => {
      if (typeof state === "undefined") return { error: "state not defined" };

      state.pageAPISecret = "VALID_SECRET_12345";

      const errorLog = [];
      const originalError = console.error;
      console.error = (...args) => errorLog.push(args.join(" "));

      let nonceRejectedSent = false;
      const originalPostMessage =
        state.lessonFrame.contentWindow.postMessage;
      state.lessonFrame.contentWindow.postMessage = (...args) => {
        if (args[0] && args[0].type === "NONCE_REJECTED") {
          nonceRejectedSent = true;
        }
      };

      const message = {
        data: {
          type: "QUIZ_RESULT",
          message: {
            id: "test-quiz",
            value: { score: 10, answers: {} }
          },
          code: "VALID_SECRET_12345",
          nonce: Date.now() - 301000
        },
        origin: window.location.origin
      };

      state.handleMessage(message);

      console.error = originalError;
      state.lessonFrame.contentWindow.postMessage = originalPostMessage;

      return {
        errorLogged: errorLog.length > 0,
        hasNonceError: errorLog.some(e => e.includes("Invalid or expired nonce")),
        nonceRejectedSent
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.errorLogged).toBe(true);
    expect(result.hasNonceError).toBe(true);
    expect(result.nonceRejectedSent).toBe(true);
  });

  test("should reject message with future nonce (clock skew)", async () => {
    const result = await page.evaluate(() => {
      if (typeof state === "undefined") return { error: "state not defined" };

      state.pageAPISecret = "VALID_SECRET_12345";

      const errorLog = [];
      const originalError = console.error;
      console.error = (...args) => errorLog.push(args.join(" "));

      let nonceRejectedSent = false;
      const originalPostMessage =
        state.lessonFrame.contentWindow.postMessage;
      state.lessonFrame.contentWindow.postMessage = (...args) => {
        if (args[0] && args[0].type === "NONCE_REJECTED") {
          nonceRejectedSent = true;
        }
      };

      const message = {
        data: {
          type: "QUIZ_RESULT",
          message: {
            id: "test-quiz",
            value: { score: 10, answers: {} }
          },
          code: "VALID_SECRET_12345",
          nonce: Date.now() + 60000
        },
        origin: window.location.origin
      };

      state.handleMessage(message);

      console.error = originalError;
      state.lessonFrame.contentWindow.postMessage = originalPostMessage;

      return {
        errorLogged: errorLog.length > 0,
        hasNonceError: errorLog.some(e => e.includes("Invalid or expired nonce")),
        nonceRejectedSent
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.errorLogged).toBe(true);
    expect(result.hasNonceError).toBe(true);
    expect(result.nonceRejectedSent).toBe(true);
  });

  test("should reject duplicate nonce within the time window", async () => {
    const result = await page.evaluate(() => {
      if (typeof state === "undefined") return { error: "state not defined" };

      state.pageAPISecret = "VALID_SECRET_12345";

      const nonce = Date.now();

      const errorLog = [];
      const originalError = console.error;
      console.error = (...args) => errorLog.push(args.join(" "));

      let nonceRejectedCount = 0;
      const originalPostMessage =
        state.lessonFrame.contentWindow.postMessage;
      state.lessonFrame.contentWindow.postMessage = (...args) => {
        if (args[0] && args[0].type === "NONCE_REJECTED") {
          nonceRejectedCount++;
        }
      };

      const makeMsg = () => ({
        data: {
          type: "QUIZ_RESULT",
          message: {
            id: "test-quiz",
            value: { score: 10, answers: {} }
          },
          code: "VALID_SECRET_12345",
          nonce
        },
        origin: window.location.origin
      });

      state.handleMessage(makeMsg());
      state.handleMessage(makeMsg());

      console.error = originalError;
      state.lessonFrame.contentWindow.postMessage = originalPostMessage;

      return {
        nonceRejectedCount,
        hasDuplicateError: errorLog.some(e => e.includes("Invalid or expired nonce"))
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.nonceRejectedCount).toBe(1);
  });

  test("should allow ORIGIN message to bypass nonce check entirely", async () => {
    const result = await page.evaluate(() => {
      if (typeof state === "undefined") return { error: "state not defined" };

      let postMessageCalled = false;
      let postMessageArgs = null;
      const originalPostMessage =
        state.lessonFrame.contentWindow.postMessage;
      state.lessonFrame.contentWindow.postMessage = (...args) => {
        postMessageCalled = true;
        postMessageArgs = args;
      };

      const originMessage = {
        data: {
          type: "ORIGIN",
          message: window.location.origin,
          code: "ANY_CODE"
        },
        origin: window.location.origin
      };

      state.handleMessage(originMessage);

      state.lessonFrame.contentWindow.postMessage = originalPostMessage;

      return {
        postMessageCalled,
        messageType: postMessageArgs ? postMessageArgs[0].type : null,
        error: postMessageCalled ? undefined : "No postMessage"
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.postMessageCalled).toBe(true);
    expect(result.messageType).toBe("ORIGIN");
  });

  test("should initialize seenNonces map and nonce prune timer on init", async () => {
    const result = await page.evaluate(() => {
      if (typeof state === "undefined") return { error: "state not defined" };
      if (!state.initialized) return { error: "state not initialized" };

      return {
        seenNoncesExists: state._seenNonces instanceof Map,
        pruneTimerExists: typeof state._noncePruneTimer === "number" && state._noncePruneTimer > 0
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.seenNoncesExists).toBe(true);
    expect(result.pruneTimerExists).toBe(true);
  });
});
