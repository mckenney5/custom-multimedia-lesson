const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.handleMessage: code validation", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should process message with valid code matching pageAPISecret", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.pageAPISecret = "VALID_SECRET_12345";

			const errorLog = [];
			const originalError = console.error;
			console.error = (...args) => errorLog.push(args.join(" "));

			const quizResultMessage = {
				data: {
					type: "QUIZ_RESULT",
					message: {
						id: "test-quiz",
						value: {
							score: 10,
							answers: {}
						}
					},
					code: "VALID_SECRET_12345",
					nonce: Date.now()
				},
				origin: window.location.origin
			};

			state.handleMessage(quizResultMessage);

			console.error = originalError;

			return {
				errorLogged: errorLog.length > 0,
				hasInvalidCodeError: errorLog.some(e => e.includes("Invalid code"))
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.errorLogged).toBe(false);
		expect(result.hasInvalidCodeError).toBe(false);
	});

	test("should reject message with invalid code that doesn't match pageAPISecret", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.pageAPISecret = "VALID_SECRET_12345";

			const errorLog = [];
			const originalError = console.error;
			console.error = (...args) => errorLog.push(args.join(" "));

			const quizResultMessage = {
				data: {
					type: "QUIZ_RESULT",
					message: {
						id: "test-quiz",
						value: {
							score: 10,
							answers: {}
						}
					},
					code: "WRONG_CODE"
				},
				origin: window.location.origin
			};

			const index = state.data.delta.currentPageIndex;
			state.handleMessage(quizResultMessage);

			console.error = originalError;

			return {
				errorLogged: errorLog.length > 0,
				errorContainsInvalidCode: errorLog.some(e => e.includes("Invalid code"))
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.errorLogged).toBe(true);
		expect(result.errorContainsInvalidCode).toBe(true);
	});

	test("should reject message with no code field", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.pageAPISecret = "VALID_SECRET_12345";

			const errorLog = [];
			const originalError = console.error;
			console.error = (...args) => errorLog.push(args.join(" "));

			const quizResultMessage = {
				data: {
					type: "QUIZ_RESULT",
					message: {
						id: "test-quiz",
						value: {
							score: 10,
							answers: {}
						}
					}
				},
				origin: window.location.origin
			};

			const index = state.data.delta.currentPageIndex;
			state.handleMessage(quizResultMessage);

			console.error = originalError;

			return {
				errorLogged: errorLog.length > 0
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.errorLogged).toBe(true);
	});

	test("should reject message when pageAPISecret is null (pre-handshake)", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.pageAPISecret = null;

			const errorLog = [];
			const originalError = console.error;
			console.error = (...args) => errorLog.push(args.join(" "));

			const quizResultMessage = {
				data: {
					type: "QUIZ_RESULT",
					message: {
						id: "test-quiz",
						value: {
							score: 10,
							answers: {}
						}
					},
					code: "ANY_CODE"
				},
				origin: window.location.origin
			};

			state.handleMessage(quizResultMessage);

			console.error = originalError;

			return {
				errorLogged: errorLog.length > 0,
				hasHandshakeError: errorLog.some(e => e.includes("handshake"))
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.errorLogged).toBe(true);
		expect(result.hasHandshakeError).toBe(true);
	});

	test("should always respond to ORIGIN message regardless of code", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			let postMessageCalled = false;
			let postMessageArgs = null;

			const originalPostMessage = state.lessonFrame.contentWindow.postMessage;
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
				hasCode: postMessageArgs ? !!postMessageArgs[0].code : false
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.postMessageCalled).toBe(true);
		expect(result.messageType).toBe("ORIGIN");
		expect(result.hasCode).toBe(true);
	});

	test("should reject non-ORIGIN message without code when pageAPISecret is set", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.pageAPISecret = "TEST_SECRET";

			const errorLog = [];
			const originalError = console.error;
			console.error = (...args) => errorLog.push(args.join(" "));

			const metaMessage = {
				data: {
					type: "SEND_META",
					message: {}
				},
				origin: window.location.origin
			};

			state.handleMessage(metaMessage);

			console.error = originalError;

			return {
				errorLogged: errorLog.length > 0
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.errorLogged).toBe(true);
	});
});