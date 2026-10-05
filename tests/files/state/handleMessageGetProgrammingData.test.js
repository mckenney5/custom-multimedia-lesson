const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.handleMessage: GET_PROGRAMMING_DATA", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should send back PROGRAMMING_DATA with full config and saved state", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.data.pages = [
				{
					name: "test.html",
					components: [
						{
							id: "prog1",
							type: "programming",
							starterCode: "// starter\nconsole.log('hi');",
							language: "javascript",
							timeout: 3000,
							expectedOutput: "hello",
							testCases: [
								{ label: "Test 1", input: "", expected: "hello" }
							],
							options: ["show-wrong"],
						},
					],
					completionRules: { attempts: 5 },
				},
			];
			state.data.delta.pagesState = [
				{
					completed: false,
					score: 0,
					components: {
						prog1: {
							type: "programming",
							testResults: [],
							score: 0,
							maxScore: 0,
							completed: false,
							attempts: 0,
						},
					},
				},
			];
			state.data.delta.currentPageIndex = 0;

			const postMessages = [];
			state.lessonFrame = {
				contentWindow: {
					postMessage: (...args) => { postMessages.push(args); },
				},
			};
			state.finalizePage = () => {};

			state.pageAPISecret = "TEST_SECRET";

			// Both nonces sit safely in the past: a nonce stamped "now" is
			// rejected as future-dated by the time the handler reads the clock.
			const baseNonce = Date.now() - 100;

			// The learner runs their exercise...
			state.handleMessage({
				data: {
					type: "CODE_EXECUTION",
					message: {
						id: "prog1",
						value: {
							code: 'console.log("saved code");',
							stdout: ["saved code"],
							testResults: [{ label: "Output matches expected", passed: true }],
							score: 1,
							maxScore: 1,
							completed: true,
						},
					},
					code: "TEST_SECRET",
					nonce: baseNonce,
				},
				origin: window.location.origin,
			});

			// ...and a component asking what it already has.
			state.handleMessage({
				data: {
					type: "GET_PROGRAMMING_DATA",
					message: {
						id: "prog1",
						value: "",
					},
					code: "TEST_SECRET",
					nonce: baseNonce + 1,
				},
				origin: window.location.origin,
			});

			const progMsg = postMessages.filter(m => m[0] && m[0].type === "PROGRAMMING_DATA").pop();

			if (!progMsg) return { error: "No PROGRAMMING_DATA message sent" };

			const value = progMsg[0].message.value;

			return {
				msgType: progMsg[0].type,
				msgId: progMsg[0].message.id,
				starterCode: value.starterCode,
				language: value.language,
				timeout: value.timeout,
				expectedOutput: value.expectedOutput,
				testCases: value.testCases,
				options: value.options,
				savedCode: value.savedCode,
				testResults: value.testResults,
				attemptsLeft: value.attemptsLeft,
				hasAttempted: value.hasAttempted,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.msgType).toBe("PROGRAMMING_DATA");
		expect(result.msgId).toBe("prog1");
		expect(result.starterCode).toBe("// starter\nconsole.log('hi');");
		expect(result.language).toBe("javascript");
		expect(result.timeout).toBe(3000);
		expect(result.expectedOutput).toBe("hello");
		expect(result.testCases).toEqual([
			{ label: "Test 1", input: "", expected: "hello" }
		]);
		expect(result.options).toEqual(["show-wrong"]);
		expect(result.savedCode).toBe('console.log("saved code");');
		expect(result.testResults).toEqual([
			{ label: "Output matches expected", passed: true }
		]);
		expect(result.attemptsLeft).toBe(4);
		expect(result.hasAttempted).toBe(true);
	});

	test("should send back PROGRAMMING_DATA with the stored score and maxScore", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.data.pages = [
				{
					name: "test.html",
					components: [{ id: "prog1", type: "programming", starterCode: "// starter" }],
					completionRules: { attempts: 1 },
				},
			];
			state.data.delta.pagesState = [
				{
					completed: true,
					score: 1,
					components: {
						prog1: {
							type: "programming",
							testResults: [],
							score: 1,
							maxScore: 1,
							completed: true,
							attempts: 1,
						},
					},
				},
			];
			state.data.delta.currentPageIndex = 0;

			const postMessages = [];
			state.lessonFrame = {
				contentWindow: {
					postMessage: (...args) => { postMessages.push(args); },
				},
			};
			state.finalizePage = () => {};
			state.pageAPISecret = "TEST_SECRET";

			state.handleMessage({
				data: {
					type: "GET_PROGRAMMING_DATA",
					message: { id: "prog1", value: "" },
					code: "TEST_SECRET",
					nonce: Date.now(),
				},
				origin: window.location.origin,
			});

			const progMsg = postMessages.find(m => m[0] && m[0].type === "PROGRAMMING_DATA");
			if (!progMsg) return { error: "No PROGRAMMING_DATA message sent" };

			return {
				score: progMsg[0].message.value.score,
				maxScore: progMsg[0].message.value.maxScore,
				attemptsLeft: progMsg[0].message.value.attemptsLeft,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.attemptsLeft).toBe(0);
		expect(result.score).toBe(1);
		expect(result.maxScore).toBe(1);
	});

	test("every PROGRAMMING_DATA reply carries a numeric attemptsLeft", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.data.pages = [
				{
					name: "test.html",
					components: [
						{ id: "prog1", type: "programming", starterCode: "// starter" },
					],
					completionRules: { attempts: 5 },
				},
			];
			state.data.delta.pagesState = [
				{
					completed: false,
					score: 0,
					components: {
						prog1: {
							type: "programming",
							testResults: [],
							score: 0,
							maxScore: 0,
							completed: false,
							attempts: 1,
						},
					},
				},
			];
			state.data.delta.currentPageIndex = 0;

			const postMessages = [];
			state.lessonFrame = {
				contentWindow: {
					postMessage: (...args) => { postMessages.push(args); },
				},
			};
			state.finalizePage = () => {};
			state.pageAPISecret = "TEST_SECRET";

			const baseNonce = Date.now() - 10;

			state.handleMessage({
				data: {
					type: "GET_PROGRAMMING_DATA",
					message: { id: "prog1", value: "" },
					code: "TEST_SECRET",
					nonce: baseNonce,
				},
				origin: window.location.origin,
			});

			state.handleMessage({
				data: {
					type: "CODE_EXECUTION",
					message: {
						id: "prog1",
						value: {
							code: "// code",
							stdout: [],
							error: null,
							testResults: [],
							score: 0,
							maxScore: 0,
							completed: false,
						},
					},
					code: "TEST_SECRET",
					nonce: baseNonce + 5,
				},
				origin: window.location.origin,
			});

			const attemptsLeftTypes = postMessages
				.map((m) => m[0])
				.filter((m) => m && m.type === "PROGRAMMING_DATA")
				.map((m) => typeof m.message.value.attemptsLeft);

			return { attemptsLeftTypes };
		});

		expect(result.error).toBeUndefined();
		expect(result.attemptsLeftTypes).toHaveLength(2);
		expect(result.attemptsLeftTypes).toEqual(["number", "number"]);
	});

	test("should not send message when componentID is missing", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.data.pages = [{ name: "test.html", components: [], completionRules: {} }];
			state.data.delta.pagesState = [{ completed: false, score: 0, components: {} }];
			state.data.delta.currentPageIndex = 0;

			const postMessages = [];
			state.lessonFrame = {
				contentWindow: {
					postMessage: (...args) => { postMessages.push(args); },
				},
			};

			state.pageAPISecret = "TEST_SECRET";

			const getMsg = {
				data: {
					type: "GET_PROGRAMMING_DATA",
					message: "",
					code: "TEST_SECRET",
					nonce: Date.now(),
				},
				origin: window.location.origin,
			};

			state.handleMessage(getMsg);

			return { postMessagesCount: postMessages.length };
		});

		expect(result.error).toBeUndefined();
		expect(result.postMessagesCount).toBe(0);
	});

	test("should not send message when component config not found", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.data.pages = [
				{
					name: "test.html",
					components: [],
					completionRules: {},
				},
			];
			state.data.delta.pagesState = [
				{
					completed: false,
					score: 0,
					components: {},
				},
			];
			state.data.delta.currentPageIndex = 0;

			const postMessages = [];
			state.lessonFrame = {
				contentWindow: {
					postMessage: (...args) => { postMessages.push(args); },
				},
			};

			state.pageAPISecret = "TEST_SECRET";

			const getMsg = {
				data: {
					type: "GET_PROGRAMMING_DATA",
					message: {
						id: "nonexistent",
						value: "",
					},
					code: "TEST_SECRET",
					nonce: Date.now(),
				},
				origin: window.location.origin,
			};

			state.handleMessage(getMsg);

			return { postMessagesCount: postMessages.length };
		});

		expect(result.error).toBeUndefined();
		expect(result.postMessagesCount).toBe(0);
	});
});
