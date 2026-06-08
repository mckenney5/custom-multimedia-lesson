const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.handleMessage: CODE_EXECUTION", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should save code, testResults, and score from CODE_EXECUTION to pageDelta", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			// Set up page data with a programming component
			state.data.pages = [
				{
					name: "test.html",
					components: [
						{
							id: "prog1",
							type: "programming",
							starterCode: "// starter",
						}
					],
					completionRules: {},
				}
			];
			state.data.delta.pagesState = [
				{
					completed: false,
					score: 0,
					components: {
						prog1: {
							type: "programming",
							codeContent: "// starter",
							testResults: [],
							score: 0,
							maxScore: 0,
							completed: false,
						},
					},
				},
			];
			state.data.delta.currentPageIndex = 0;

			// Mock lessonFrame to avoid postMessage errors
			const postMessages = [];
			state.lessonFrame = {
				contentWindow: {
					postMessage: (...args) => { postMessages.push(args); },
				},
			};

			// Mock finalizePage
			let finalizeCalled = false;
			state.finalizePage = () => { finalizeCalled = true; };

			state.pageAPISecret = "TEST_SECRET";

			const execMessage = {
				data: {
					type: "CODE_EXECUTION",
					message: {
						id: "prog1",
						value: {
							code: 'console.log("hello");',
							stdout: ["hello"],
							returnValue: undefined,
							error: null,
							testResults: [
								{ label: "Output matches expected", passed: true }
							],
							score: 1,
							maxScore: 1,
							completed: true,
						},
					},
					code: "TEST_SECRET",
					nonce: Date.now(),
				},
				origin: window.location.origin,
			};

			state.handleMessage(execMessage);

			const compState = state.data.delta.pagesState[0].components.prog1;

			return {
				codeContent: compState.codeContent,
				testResults: compState.testResults,
				score: compState.score,
				maxScore: compState.maxScore,
				completed: compState.completed,
				postMessagesCount: postMessages.length,
				finalizeCalled,
				pageScore: state.data.delta.pagesState[0].score,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.codeContent).toBe('console.log("hello");');
		expect(result.testResults).toEqual([
			{ label: "Output matches expected", passed: true }
		]);
		expect(result.score).toBe(1);
		expect(result.maxScore).toBe(1);
		expect(result.completed).toBe(true);
	});

	test("should return updated attempts and testResults via PROGRAMMING_DATA postMessage", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.data.pages = [
				{
					name: "test.html",
					components: [
						{
							id: "prog1",
							type: "programming",
							starterCode: "// starter",
						}
					],
					completionRules: { attempts: 3 },
				}
			];
			state.data.delta.pagesState = [
				{
					completed: false,
					score: 0,
					components: {
						prog1: {
							type: "programming",
							codeContent: "// starter",
							testResults: [],
							score: 0,
							maxScore: 0,
							completed: false,
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

			let finalizeCalled = false;
			state.finalizePage = () => { finalizeCalled = true; };

			state.pageAPISecret = "TEST_SECRET";

			const execMessage = {
				data: {
					type: "CODE_EXECUTION",
					message: {
						id: "prog1",
						value: {
							code: 'console.log("hello");',
							stdout: ["hello"],
							returnValue: undefined,
							error: null,
							testResults: [
								{ label: "Output matches expected", passed: true }
							],
							score: 1,
							maxScore: 1,
							completed: true,
						},
					},
					code: "TEST_SECRET",
					nonce: Date.now(),
				},
				origin: window.location.origin,
			};

			state.handleMessage(execMessage);

			const progMsg = postMessages.find(m => m[0] && m[0].type === "PROGRAMMING_DATA");

			return {
				finalizeCalled,
				progMsgSent: !!progMsg,
				msgType: progMsg ? progMsg[0].type : null,
				msgId: progMsg ? progMsg[0].message.id : null,
				attemptsLeft: progMsg ? progMsg[0].message.value.attemptsLeft : null,
				hasAttempted: progMsg ? progMsg[0].message.value.hasAttempted : null,
				msgTestResults: progMsg ? progMsg[0].message.value.testResults : null,
				pageScore: state.data.delta.pagesState[0].score,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.finalizeCalled).toBe(true);
		expect(result.progMsgSent).toBe(true);
		expect(result.msgType).toBe("PROGRAMMING_DATA");
		expect(result.msgId).toBe("prog1");
		expect(result.attemptsLeft).toBe(2);
		expect(result.hasAttempted).toBe(true);
		expect(result.msgTestResults).toEqual([
			{ label: "Output matches expected", passed: true }
		]);
	});
});
