const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.handleMessage: CODE_EXECUTION", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
		await page.evaluate(() => {
			window.__codeExec = {
				postMessages: [],
				finalizeCalled: false,
				nonce: Date.now(),
				setup(completionRules) {
					state.data.pages = [
						{
							name: "test.html",
							components: [
								{ id: "prog1", type: "programming", starterCode: "// starter" },
							],
							completionRules: completionRules || {},
						},
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
					window.__codeExec.postMessages = [];
					window.__codeExec.finalizeCalled = false;
					state.lessonFrame = {
						contentWindow: {
							postMessage: (...args) => { window.__codeExec.postMessages.push(args); },
						},
					};
					state.finalizePage = () => { window.__codeExec.finalizeCalled = true; };
					state.pageAPISecret = "TEST_SECRET";
				},
				run(value) {
					const runValue = Object.assign({
						code: "// code",
						stdout: [],
						returnValue: undefined,
						error: null,
						testResults: [],
						score: 0,
						maxScore: 0,
						completed: false,
					}, value);
					state.handleMessage({
						data: {
							type: "CODE_EXECUTION",
							message: { id: "prog1", value: runValue },
							code: "TEST_SECRET",
							nonce: window.__codeExec.nonce++,
						},
						origin: window.location.origin,
					});
				},
				compState() {
					return state.data.delta.pagesState[0].components.prog1;
				},
				pageState() {
					return state.data.delta.pagesState[0];
				},
			};
		});
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should save code, testResults, and score from CODE_EXECUTION to pageDelta", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup();
			harness.run({
				code: 'console.log("hello");',
				stdout: ["hello"],
				testResults: [
					{ label: "Output matches expected", passed: true }
				],
				score: 1,
				maxScore: 1,
				completed: true,
			});

			return {
				codeContent: harness.compState().codeContent,
				testResults: harness.compState().testResults,
				score: harness.compState().score,
				maxScore: harness.compState().maxScore,
				completed: harness.compState().completed,
				postMessagesCount: harness.postMessages.length,
				finalizeCalled: harness.finalizeCalled,
				pageScore: harness.pageState().score,
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

			const harness = window.__codeExec;
			harness.setup({ attempts: 3 });
			harness.run({
				code: 'console.log("hello");',
				stdout: ["hello"],
				testResults: [
					{ label: "Output matches expected", passed: true }
				],
				score: 1,
				maxScore: 1,
				completed: true,
			});

			const progMsg = harness.postMessages.find(m => m[0] && m[0].type === "PROGRAMMING_DATA");

			return {
				finalizeCalled: harness.finalizeCalled,
				progMsgSent: !!progMsg,
				msgType: progMsg ? progMsg[0].type : null,
				msgId: progMsg ? progMsg[0].message.id : null,
				attemptsLeft: progMsg ? progMsg[0].message.value.attemptsLeft : null,
				hasAttempted: progMsg ? progMsg[0].message.value.hasAttempted : null,
				msgTestResults: progMsg ? progMsg[0].message.value.testResults : null,
				pageScore: harness.pageState().score,
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

	test("PROGRAMMING_DATA reply carries the best score and maxScore", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup({ attempts: 5 });
			harness.run({ score: 1, maxScore: 1, completed: true });
			harness.run({ score: 0, maxScore: 1, completed: false });

			const progMsg = harness.postMessages.filter(m => m[0] && m[0].type === "PROGRAMMING_DATA").pop();

			return {
				score: progMsg ? progMsg[0].message.value.score : null,
				maxScore: progMsg ? progMsg[0].message.value.maxScore : null,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.score).toBe(1);
		expect(result.maxScore).toBe(1);
	});

	test("a later failing run cannot lower the stored score", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup();
			harness.run({ score: 1, maxScore: 1, completed: true });
			harness.run({ score: 0, maxScore: 1, completed: false });

			return {
				score: harness.compState().score,
				maxScore: harness.compState().maxScore,
				pageScore: harness.pageState().score,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.score).toBe(1);
		expect(result.maxScore).toBe(1);
		expect(result.pageScore).toBe(1);
	});

	test("completed never flips back to false after a passing run", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup();
			harness.run({ score: 1, maxScore: 1, completed: true });
			harness.run({ score: 0, maxScore: 1, completed: false });

			return { completed: harness.compState().completed };
		});

		expect(result.error).toBeUndefined();
		expect(result.completed).toBe(true);
	});

	test("a later passing run raises the stored score", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup();
			harness.run({ score: 0, maxScore: 1, completed: false });
			harness.run({ score: 1, maxScore: 1, completed: true });

			return {
				score: harness.compState().score,
				completed: harness.compState().completed,
				pageScore: harness.pageState().score,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.score).toBe(1);
		expect(result.completed).toBe(true);
		expect(result.pageScore).toBe(1);
	});

	test("a run that did not reach the sandbox does not consume an attempt", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup({ attempts: 3 });
			harness.run({ consumesAttempt: false, error: "Code contains banned pattern", completed: false });

			const progMsg = harness.postMessages.filter(m => m[0] && m[0].type === "PROGRAMMING_DATA").pop();

			return {
				attempts: harness.compState().attempts,
				attemptsLeft: progMsg ? progMsg[0].message.value.attemptsLeft : null,
				hasAttempted: progMsg ? progMsg[0].message.value.hasAttempted : null,
				score: harness.compState().score,
				completed: harness.compState().completed,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.attempts).toBeUndefined();
		expect(result.attemptsLeft).toBe(3);
		expect(result.hasAttempted).toBe(false);
		expect(result.score).toBe(0);
		expect(result.completed).toBe(false);
	});

	test("a maxScore: 0 sender cannot clobber the stored maxScore", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup({ attempts: 3 });
			harness.run({ score: 1, maxScore: 1, completed: true });
			harness.run({ score: 0, maxScore: 0, completed: false });

			const progMsg = harness.postMessages.filter(m => m[0] && m[0].type === "PROGRAMMING_DATA").pop();

			return {
				maxScore: harness.compState().maxScore,
				score: harness.compState().score,
				completed: harness.compState().completed,
				replyMaxScore: progMsg ? progMsg[0].message.value.maxScore : null,
				replyScore: progMsg ? progMsg[0].message.value.score : null,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.maxScore).toBe(1);
		expect(result.score).toBe(1);
		expect(result.completed).toBe(true);
		expect(result.replyMaxScore).toBe(1);
		expect(result.replyScore).toBe(1);
	});

	test("a message with a missing score does not poison the stored or page score", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup();
			harness.run({ score: 1, maxScore: 2, completed: true });
			harness.run({ score: undefined, maxScore: 2, completed: false });

			return {
				score: harness.compState().score,
				maxScore: harness.compState().maxScore,
				pageScore: harness.pageState().score,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.score).toBe(1);
		expect(result.maxScore).toBe(2);
		expect(Number.isFinite(result.pageScore)).toBe(true);
		expect(result.pageScore).toBe(1);
	});
});
