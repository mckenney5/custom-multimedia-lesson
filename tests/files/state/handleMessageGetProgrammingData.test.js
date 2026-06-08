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
					score: 1,
					components: {
						prog1: {
							type: "programming",
							codeContent: 'console.log("saved code");',
							testResults: [{ label: "Output matches expected", passed: true }],
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

			state.pageAPISecret = "TEST_SECRET";

			const getMsg = {
				data: {
					type: "GET_PROGRAMMING_DATA",
					message: {
						id: "prog1",
						value: "",
					},
					code: "TEST_SECRET",
					nonce: Date.now(),
				},
				origin: window.location.origin,
			};

			state.handleMessage(getMsg);

			const progMsg = postMessages.find(m => m[0] && m[0].type === "PROGRAMMING_DATA");

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
