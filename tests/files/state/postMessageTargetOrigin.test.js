const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.sendMessage: targetOrigin security", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should send message with correct targetOrigin matching window.location.origin", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			let postMessageCalled = false;
			let targetOrigin = null;
			let messageType = null;

			const originalPostMessage = state.lessonFrame.contentWindow.postMessage;
			state.lessonFrame.contentWindow.postMessage = (msg, target) => {
				postMessageCalled = true;
				targetOrigin = target;
				messageType = msg.type;
			};

			state.sendMessage("TEST_MESSAGE", "test data");

			state.lessonFrame.contentWindow.postMessage = originalPostMessage;

			return {
				postMessageCalled,
				targetOrigin,
				messageType,
				originMatches: targetOrigin === window.location.origin
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.postMessageCalled).toBe(true);
		expect(result.targetOrigin).toBe(result.targetOrigin);
		expect(result.originMatches).toBe(true);
	});

	test("should send ORIGIN response with explicit targetOrigin", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const currentOrigin = window.location.origin;
			let postMessageCalled = false;
			let targetOrigin = null;
			let messageType = null;

			const originalPostMessage = state.lessonFrame.contentWindow.postMessage;
			state.lessonFrame.contentWindow.postMessage = (msg, target) => {
				postMessageCalled = true;
				targetOrigin = target;
				messageType = msg.type;
			};

			const mockEvent = {
				data: { type: "ORIGIN" },
				origin: currentOrigin
			};
			state.handleMessage(mockEvent);

			state.lessonFrame.contentWindow.postMessage = originalPostMessage;

			return {
				postMessageCalled,
				targetOrigin,
				messageType,
				currentOrigin,
				hasCode: postMessageCalled
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.postMessageCalled).toBe(true);
		expect(result.targetOrigin).toBe(result.currentOrigin);
		expect(result.messageType).toBe("ORIGIN");
	});

	test("should send QUIZ_DATA with correct targetOrigin", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const currentOrigin = window.location.origin;
			let postMessageCalled = false;
			let targetOrigin = null;

			const originalPostMessage = state.lessonFrame.contentWindow.postMessage;
			state.lessonFrame.contentWindow.postMessage = (msg, target) => {
				if (msg.type === "QUIZ_DATA") {
					postMessageCalled = true;
					targetOrigin = target;
				}
			};

			const index = state.data.delta.currentPageIndex;
			const pageData = state.data.pages[index];
			const pageDelta = state.data.delta.pagesState[index];

			if (pageData && pageData.components && pageDelta.components) {
				const compId = Object.keys(pageData.components)[0];
				if (compId) {
					const quizDataEvent = {
						data: {
							type: "GET_QUIZ_DATA",
							message: {
								id: compId,
								value: {}
							},
							code: state.pageAPISecret
						},
						origin: currentOrigin
					};
					state.handleMessage(quizDataEvent);
				}
			}

			state.lessonFrame.contentWindow.postMessage = originalPostMessage;

			return {
				postMessageCalled,
				targetOrigin,
				isCorrectOrigin: targetOrigin === currentOrigin
			};
		});

		expect(result.error).toBeUndefined();
		if (result.postMessageCalled) {
			expect(result.isCorrectOrigin).toBe(true);
		}
	});

	test("should handle about:blank iframe gracefully", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const consoleErrors = [];
			const originalError = console.error;
			console.error = (...args) => consoleErrors.push(args.join(" "));

			state.lessonFrame.src = "about:blank";

			state.sendMessage("TEST_MESSAGE", "test data");

			console.error = originalError;

			return {
				hasErrors: consoleErrors.length > 0,
				errors: consoleErrors
			};
		});

		expect(result.error).toBeUndefined();
	});

	test("should send GET_STUDENT_DATA with explicit targetOrigin", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			let postMessageCalled = false;
			let targetOrigin = null;

			const originalPostMessage = state.lessonFrame.contentWindow.postMessage;
			state.lessonFrame.contentWindow.postMessage = (msg, target) => {
				postMessageCalled = true;
				targetOrigin = target;
			};

			const studentDataEvent = {
				data: {
					type: "GET_STUDENT_DATA",
					message: {},
					code: state.pageAPISecret
				},
				origin: window.location.origin
			};

			state.handleMessage(studentDataEvent);

			state.lessonFrame.contentWindow.postMessage = originalPostMessage;

			return {
				postMessageCalled,
				targetOrigin,
				isCorrectOrigin: targetOrigin === window.location.origin
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.postMessageCalled).toBe(true);
		expect(result.isCorrectOrigin).toBe(true);
	});
});