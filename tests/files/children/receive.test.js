const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('receive()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/children.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should validate message origin and block incorrect origins', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = 'http://correct.origin';

      const errorLog = [];
      const originalError = console.error;
      console.error = (...args) => {
        errorLog.push(args.join(' '));
      };

      try {
        const wrongOriginEvent = {
          data: {
            type: "TEST_TYPE",
            message: "test"
          },
          origin: "http://wrong.origin"
        };

        child.receive(wrongOriginEvent);

        return {
          errorLogged: errorLog.length > 0,
          errorLog
        };
      } finally {
        console.error = originalError;
      }
    });

    expect(result.errorLogged).toBe(true);
    expect(result.errorLog[0]).toContain("Blocked message");
  });

  test('should handle PING message by sending PONG', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = 'http://correct.origin';

      const sendCalls = [];
      const originalSend = child.send;
      child.send = (...args) => {
        sendCalls.push(args);
      };

      try {
        const pingEvent = {
          data: {
            type: "PING",
            message: "ping data"
          },
          origin: "http://correct.origin"
        };

        child.receive(pingEvent);

        return {
          sendCalled: sendCalls.length > 0,
          pongSent: sendCalls[0] && sendCalls[0][0] === "PONG" && sendCalls[0][1] === "ping data"
        };
      } finally {
        child.send = originalSend;
      }
    });

    expect(result.sendCalled).toBe(true);
    expect(result.pongSent).toBe(true);
  });

  test('should handle SEND_META by firing meta-information event with correct data', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = 'http://correct.origin';

      const fireCalls = [];
      const originalFire = child.events.fire;
      child.events.fire = (subject, data) => {
        fireCalls.push({ subject, data });
      };

      try {
        const metaEvent = {
          data: {
            type: "SEND_META",
            message: { version: "1.0" }
          },
          origin: "http://correct.origin"
        };

        child.receive(metaEvent);

        return {
          fireCalled: fireCalls.length > 0,
          subject: fireCalls[0] ? fireCalls[0].subject : null,
          dataMatches: fireCalls[0] && fireCalls[0].subject === "meta-information" &&
            fireCalls[0].data && fireCalls[0].data.version === "1.0"
        };
      } finally {
        child.events.fire = originalFire;
      }
    });

    expect(result.fireCalled).toBe(true);
    expect(result.subject).toBe("meta-information");
    expect(result.dataMatches).toBe(true);
  });

  test('should handle GET_STUDENT_DATA by firing student-data event', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = 'http://correct.origin';

      const fireCalls = [];
      const originalFire = child.events.fire;
      child.events.fire = (subject, data) => {
        fireCalls.push({ subject, data });
      };

      try {
        const studentEvent = {
          data: {
            type: "GET_STUDENT_DATA",
            message: { name: "John Doe", grade: "A" }
          },
          origin: "http://correct.origin"
        };

        child.receive(studentEvent);

        return {
          fireCalled: fireCalls.length > 0,
          subject: fireCalls[0] ? fireCalls[0].subject : null,
          name: fireCalls[0] ? fireCalls[0].data.name : null,
          grade: fireCalls[0] ? fireCalls[0].data.grade : null
        };
      } finally {
        child.events.fire = originalFire;
      }
    });

    expect(result.fireCalled).toBe(true);
    expect(result.subject).toBe("student-data");
    expect(result.name).toBe("John Doe");
    expect(result.grade).toBe("A");
  });

  test('should handle GET_QUIZ_DATA by firing quiz-data event', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = 'http://correct.origin';

      const fireCalls = [];
      const originalFire = child.events.fire;
      child.events.fire = (subject, data) => {
        fireCalls.push({ subject, data });
      };

      try {
        const quizEvent = {
          data: {
            type: "GET_QUIZ_DATA",
            message: { questions: ["q1", "q2"] }
          },
          origin: "http://correct.origin"
        };

        child.receive(quizEvent);

        return {
          fireCalled: fireCalls.length > 0,
          subject: fireCalls[0] ? fireCalls[0].subject : null,
          dataMatches: fireCalls[0] && fireCalls[0].subject === "quiz-data" &&
            fireCalls[0].data && fireCalls[0].data.questions && fireCalls[0].data.questions.length === 2
        };
      } finally {
        child.events.fire = originalFire;
      }
    });

    expect(result.fireCalled).toBe(true);
    expect(result.subject).toBe("quiz-data");
    expect(result.dataMatches).toBe(true);
  });

  test('should handle QUIZ_DATA and QUIZ_RESULTS by firing correct events', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = 'http://correct.origin';

      const fireCalls = [];
      const originalFire = child.events.fire;
      child.events.fire = (subject, data) => {
        fireCalls.push({ subject, data });
      };

      try {
        const quizDataEvent = {
          data: {
            type: "QUIZ_DATA",
            message: { question: "What is 2+2?" }
          },
          origin: "http://correct.origin"
        };

        child.receive(quizDataEvent);

        const quizResultsEvent = {
          data: {
            type: "QUIZ_RESULTS",
            message: { score: 95 }
          },
          origin: "http://correct.origin"
        };

        child.receive(quizResultsEvent);

        return {
          fireCallsLength: fireCalls.length,
          subjects: fireCalls.map(f => f.subject),
          quizDataFired: fireCalls[0] && fireCalls[0].subject === "quiz-data",
          quizResultsFired: fireCalls[1] && fireCalls[1].subject === "quiz-results"
        };
      } finally {
        child.events.fire = originalFire;
      }
    });

    expect(result.fireCallsLength).toBe(2);
    expect(result.quizDataFired).toBe(true);
    expect(result.quizResultsFired).toBe(true);
  });

  test('should handle SET_THEME by setting data-theme attribute', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = 'http://correct.origin';
      document.documentElement.removeAttribute("data-theme");

      try {
        const themeEvent = {
          data: {
            type: "SET_THEME",
            message: "dark"
          },
          origin: "http://correct.origin"
        };

        child.receive(themeEvent);

        return {
          themeSet: document.documentElement.getAttribute("data-theme") === "dark"
        };
      } finally {
        document.documentElement.removeAttribute("data-theme");
      }
    });

    expect(result.themeSet).toBe(true);
  });

  test('should inject _targetId into message object when id is present', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = 'http://correct.origin';

      const fireCalls = [];
      const originalFire = child.events.fire;
      child.events.fire = (subject, data) => {
        fireCalls.push({ subject, data });
      };

      try {
        const event = {
          data: {
            type: "SEND_META",
            message: { version: "1.0" },
            id: "component-42"
          },
          origin: "http://correct.origin"
        };

        child.receive(event);

        return {
          fireCalled: fireCalls.length > 0,
          targetIdInjected: fireCalls[0] && fireCalls[0].data._targetId === "component-42"
        };
      } finally {
        child.events.fire = originalFire;
      }
    });

    expect(result.fireCalled).toBe(true);
    expect(result.targetIdInjected).toBe(true);
  });

  test('should not inject _targetId when message is not an object', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = 'http://correct.origin';

      const fireCalls = [];
      const originalFire = child.events.fire;
      child.events.fire = (subject, data) => {
        fireCalls.push({ subject, data });
      };

      try {
        const event = {
          data: {
            type: "SEND_META",
            message: "just a string",
            id: "component-42"
          },
          origin: "http://correct.origin"
        };

        child.receive(event);

        return {
          fireCalled: fireCalls.length > 0,
          targetIdNotInjected: fireCalls[0] && fireCalls[0].data._targetId === undefined
        };
      } finally {
        child.events.fire = originalFire;
      }
    });

    expect(result.fireCalled).toBe(true);
    expect(result.targetIdNotInjected).toBe(true);
  });

  test('should handle PROGRAMMING_DATA by firing programming-data event', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = 'http://correct.origin';

      const fireCalls = [];
      const originalFire = child.events.fire;
      child.events.fire = (subject, data) => {
        fireCalls.push({ subject, data });
      };

      try {
        const progEvent = {
          data: {
            type: "PROGRAMMING_DATA",
            message: {
              id: "prog1",
              value: { attemptsLeft: 3, hasAttempted: false, testResults: [] }
            }
          },
          origin: "http://correct.origin"
        };

        child.receive(progEvent);

        return {
          fireCalled: fireCalls.length > 0,
          subject: fireCalls[0] ? fireCalls[0].subject : null,
          dataMatches: fireCalls[0] &&
            fireCalls[0].subject === "programming-data" &&
            fireCalls[0].data &&
            fireCalls[0].data.id === "prog1" &&
            fireCalls[0].data.value.attemptsLeft === 3
        };
      } finally {
        child.events.fire = originalFire;
      }
    });

    expect(result.fireCalled).toBe(true);
    expect(result.subject).toBe("programming-data");
    expect(result.dataMatches).toBe(true);
  });

  test('should log error for unknown message types', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = 'http://correct.origin';

      const errorLog = [];
      const originalError = console.error;
      console.error = (...args) => {
        errorLog.push(args.join(' '));
      };

      try {
        const unknownEvent = {
          data: {
            type: "UNKNOWN_TYPE",
            message: "some data"
          },
          origin: "http://correct.origin"
        };

        child.receive(unknownEvent);

        return {
          errorLogged: errorLog.length > 0,
          errorLog
        };
      } finally {
        console.error = originalError;
      }
    });

    expect(result.errorLogged).toBe(true);
    expect(result.errorLog[0]).toContain("Unknown message from parent");
  });

  test('should ignore messages from null origin without logging blocked message', async () => {
    const result = await page.evaluate(() => {
      child.parentOrigin = 'http://correct.origin';

      const errorLog = [];
      const originalError = console.error;
      console.error = (...args) => {
        errorLog.push(args.join(' '));
      };

      try {
        const nullOriginEvent = {
          data: { type: "PING", message: {} },
          origin: "null"
        };

        child.receive(nullOriginEvent);

        return { errorLogged: errorLog.length > 0, errorLog };
      } finally {
        console.error = originalError;
      }
    });

    expect(result.errorLogged).toBe(false);
  });
});
