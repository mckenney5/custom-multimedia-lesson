const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("children.js nonce replay protection", () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: "../src/internal/children.js" });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("send() should include nonce as a top-level field in postMessage", async () => {
    const result = await page.evaluate(() => {
      child.pageAPICode = "TEST_API_CODE";
      child.parentOrigin = "http://parent.origin";
      child.messageQueue = [];

      const originalPostMessage = window.parent.postMessage;
      let postMessageArgs = null;
      window.parent.postMessage = (...args) => {
        postMessageArgs = args;
      };

      try {
        child.send("TEST_SUBJECT", "TEST_BODY", "TEST_ID");
        return {
          hasNonce: postMessageArgs[0] && "nonce" in postMessageArgs[0]
        };
      } finally {
        window.parent.postMessage = originalPostMessage;
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.hasNonce).toBe(true);
  });

  test("send() nonce should be a number", async () => {
    const result = await page.evaluate(() => {
      child.pageAPICode = "TEST_API_CODE";
      child.parentOrigin = "http://parent.origin";
      child.messageQueue = [];

      const originalPostMessage = window.parent.postMessage;
      let postMessageArgs = null;
      window.parent.postMessage = (...args) => {
        postMessageArgs = args;
      };

      try {
        child.send("TEST_SUBJECT", "TEST_BODY", "TEST_ID");
        return {
          nonceType: typeof postMessageArgs[0].nonce,
          isNumber: typeof postMessageArgs[0].nonce === "number"
        };
      } finally {
        window.parent.postMessage = originalPostMessage;
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.isNumber).toBe(true);
  });

  test("send() should cache _lastSent with subject, body, id, nonce", async () => {
    const result = await page.evaluate(() => {
      child.pageAPICode = "TEST_API_CODE";
      child.parentOrigin = "http://parent.origin";
      child.messageQueue = [];

      const originalPostMessage = window.parent.postMessage;
      window.parent.postMessage = () => {};

      try {
        child.send("TEST_SUBJECT", "TEST_BODY", "TEST_ID");

        return {
          hasLastSent: !!child._lastSent,
          subject: child._lastSent.subject,
          body: child._lastSent.body,
          id: child._lastSent.id,
          nonceType: typeof child._lastSent.nonce,
          keys: Object.keys(child._lastSent).sort().join(",")
        };
      } finally {
        window.parent.postMessage = originalPostMessage;
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.hasLastSent).toBe(true);
    expect(result.subject).toBe("TEST_SUBJECT");
    expect(result.body).toBe("TEST_BODY");
    expect(result.id).toBe("TEST_ID");
    expect(result.nonceType).toBe("number");
  });

  test("NONCE_REJECTED should trigger retry with a different nonce", async () => {
    const result = await page.evaluate(() => {
      child.pageAPICode = "TEST_API_CODE";
      child.parentOrigin = "http://parent.origin";
      child.messageQueue = [];

      const sentNonces = [];
      const originalPostMessage = window.parent.postMessage;
      window.parent.postMessage = (...args) => {
        if (args[0] && args[0].type !== "ORIGIN") {
          sentNonces.push(args[0].nonce);
        }
      };

      try {
        child.send("TEST_SUBJECT", "TEST_BODY", "TEST_ID");
        const firstNonce = child._lastSent.nonce;

        const rejectEvent = {
          data: { type: "NONCE_REJECTED", nonce: firstNonce },
          origin: "http://parent.origin"
        };
        child.receive(rejectEvent);

        return {
          firstNonce,
          retryNonce: sentNonces[1],
          sentCount: sentNonces.length,
          noncesAreDifferent: sentNonces.length >= 2 && sentNonces[0] !== sentNonces[1]
        };
      } finally {
        window.parent.postMessage = originalPostMessage;
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.sentCount).toBe(2);
    expect(result.noncesAreDifferent).toBe(true);
  });

  test("retry nonces should be strictly increasing with each attempt", async () => {
    const result = await page.evaluate(() => {
      child.pageAPICode = "TEST_API_CODE";
      child.parentOrigin = "http://parent.origin";
      child.messageQueue = [];

      const sentNonces = [];
      const originalPostMessage = window.parent.postMessage;
      window.parent.postMessage = (...args) => {
        if (args[0] && args[0].type !== "ORIGIN") {
          sentNonces.push(args[0].nonce);
        }
      };

      try {
        child.send("TEST_SUBJECT", "TEST_BODY", "TEST_ID");
        const firstNonce = child._lastSent.nonce;

        for(let i = 0; i < 2; i++){
          const rejectEvent = {
            data: { type: "NONCE_REJECTED", nonce: child._lastSent.nonce },
            origin: "http://parent.origin"
          };
          child.receive(rejectEvent);
        }

        return {
          sentCount: sentNonces.length,
          nonces: sentNonces,
          strictlyIncreasing:
            sentNonces.length >= 3 &&
            sentNonces[0] < sentNonces[1] &&
            sentNonces[1] < sentNonces[2]
        };
      } finally {
        window.parent.postMessage = originalPostMessage;
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.sentCount).toBe(3);
    expect(result.strictlyIncreasing).toBe(true);
  });

  test("NONCE_REJECTED with mismatched nonce should not trigger retry", async () => {
    const result = await page.evaluate(() => {
      child.pageAPICode = "TEST_API_CODE";
      child.parentOrigin = "http://parent.origin";
      child.messageQueue = [];

      let postMessageCount = 0;
      const originalPostMessage = window.parent.postMessage;
      window.parent.postMessage = (...args) => {
        if (args[0] && args[0].type !== "ORIGIN") {
          postMessageCount++;
        }
      };

      try {
        child.send("TEST_SUBJECT", "TEST_BODY");
        const firstSentCount = postMessageCount;

        const wrongRejectEvent = {
          data: { type: "NONCE_REJECTED", nonce: -1 },
          origin: "http://parent.origin"
        };
        child.receive(wrongRejectEvent);

        return {
          countAfterBadReject: postMessageCount,
          noExtraSend: postMessageCount === firstSentCount
        };
      } finally {
        window.parent.postMessage = originalPostMessage;
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.noExtraSend).toBe(true);
    expect(result.countAfterBadReject).toBe(1);
  });

  test("should stop retrying after 3 NONCE_REJECTED responses", async () => {
    const result = await page.evaluate(() => {
      child.pageAPICode = "TEST_API_CODE";
      child.parentOrigin = "http://parent.origin";
      child.messageQueue = [];

      let postMessageCount = 0;
      const originalPostMessage = window.parent.postMessage;
      window.parent.postMessage = (...args) => {
        if (args[0] && args[0].type !== "ORIGIN") {
          postMessageCount++;
        }
      };

      try {
        child.send("TEST_SUBJECT", "TEST_BODY");

        for(let i = 0; i < 4; i++){
          const rejectEvent = {
            data: { type: "NONCE_REJECTED", nonce: child._lastSent.nonce },
            origin: "http://parent.origin"
          };
          child.receive(rejectEvent);
        }

        return {
          totalSends: postMessageCount,
          retries: postMessageCount - 1,
          maxThreeRetries: postMessageCount === 4
        };
      } finally {
        window.parent.postMessage = originalPostMessage;
      }
    });

    expect(result.error).toBeUndefined();
    // 1 original send + 3 retries = 4 total
    expect(result.totalSends).toBe(4);
    expect(result.retries).toBe(3);
  });
});
