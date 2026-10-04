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
				setup(completionRules, componentIds) {
					const ids = componentIds || ["prog1"];
					const componentState = {};
					ids.forEach((id) => {
						componentState[id] = {
							type: "programming",
							codeContent: "// starter",
							testResults: [],
							score: 0,
							maxScore: 0,
							completed: false,
						};
					});
					state.data.pages = [
						{
							name: "test.html",
							components: ids.map((id) => ({ id, type: "programming", starterCode: "// starter" })),
							completionRules: completionRules || {},
						},
					];
					state.data.delta.pagesState = [
						{
							completed: false,
							score: 0,
							components: componentState,
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
				run(value, componentId) {
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
							message: { id: componentId || "prog1", value: runValue },
							code: "TEST_SECRET",
							nonce: window.__codeExec.nonce++,
						},
						origin: window.location.origin,
					});
				},
				compState(id) {
					return state.data.delta.pagesState[0].components[id || "prog1"];
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
		expect(result.pageScore).toBe(1);
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
		expect(result.pageScore).toBe(1);
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

	test("page score is re-summed across components and keeps each component's best score", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup({}, ["prog1", "prog2"]);
			harness.run({ score: 1, maxScore: 1, completed: true });
			harness.run({ score: 2, maxScore: 2, completed: true }, "prog2");

			const afterBoth = harness.pageState().score;
			harness.run({ score: 0, maxScore: 1, completed: false });

			return {
				afterBoth,
				afterLaterFailure: harness.pageState().score,
				prog1Score: harness.compState().score,
				prog2Score: harness.compState("prog2").score,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.afterBoth).toBe(3);
		expect(result.afterLaterFailure).toBe(3);
		expect(result.prog1Score).toBe(1);
		expect(result.prog2Score).toBe(2);
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

	test("a non-consuming run leaves persisted testResults untouched", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup({ attempts: 3 });
			harness.run({
				code: 'console.log("hello");',
				stdout: ["hello"],
				testResults: [{ label: "Output matches expected", passed: true }],
				score: 1,
				maxScore: 1,
				completed: true,
			});
			harness.run({
				code: "evil_code();",
				error: 'Code contains banned pattern: "evil_code"',
				consumesAttempt: false,
				testResults: [],
				score: 0,
				maxScore: 0,
				completed: false,
			});

			return {
				testResults: harness.compState().testResults,
				attempts: harness.compState().attempts,
				score: harness.compState().score,
				completed: harness.compState().completed,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.testResults).toEqual([{ label: "Output matches expected", passed: true }]);
		expect(result.attempts).toBe(1);
		expect(result.score).toBe(1);
		expect(result.completed).toBe(true);
	});

	test("the reply after a non-consuming run echoes the persisted testResults", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup({ attempts: 3 });
			harness.run({
				code: 'console.log("hello");',
				stdout: ["hello"],
				testResults: [{ label: "Output matches expected", passed: true }],
				score: 1,
				maxScore: 1,
				completed: true,
			});
			harness.run({
				code: "evil_code();",
				error: 'Code contains banned pattern: "evil_code"',
				consumesAttempt: false,
				testResults: [],
				score: 0,
				maxScore: 0,
				completed: false,
			});

			const progMsg = harness.postMessages.filter(m => m[0] && m[0].type === "PROGRAMMING_DATA").pop();

			return {
				replyTestResults: progMsg ? progMsg[0].message.value.testResults : null,
				replyAttemptsLeft: progMsg ? progMsg[0].message.value.attemptsLeft : null,
				replyScore: progMsg ? progMsg[0].message.value.score : null,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.replyTestResults).toEqual([{ label: "Output matches expected", passed: true }]);
		expect(result.replyAttemptsLeft).toBe(2);
		expect(result.replyScore).toBe(1);
	});

	test("the reply reports whether the run consumed an attempt", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup({ attempts: 3 });
			harness.run({
				code: 'console.log("hello");',
				stdout: ["hello"],
				testResults: [{ label: "Output matches expected", passed: true }],
				score: 1,
				maxScore: 1,
				completed: true,
			});
			const consuming = harness.postMessages.filter(m => m[0] && m[0].type === "PROGRAMMING_DATA").pop();

			harness.run({
				code: "evil_code();",
				error: 'Code contains banned pattern: "evil_code"',
				consumesAttempt: false,
				testResults: [],
				score: 0,
				maxScore: 0,
				completed: false,
			});
			const nonConsuming = harness.postMessages.filter(m => m[0] && m[0].type === "PROGRAMMING_DATA").pop();

			return {
				consumingFlag: consuming ? consuming[0].message.value.consumesAttempt : null,
				nonConsumingFlag: nonConsuming ? nonConsuming[0].message.value.consumesAttempt : null,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.consumingFlag).toBe(true);
		expect(result.nonConsumingFlag).toBe(false);
	});

	test("a config-not-loaded run does not wipe results restored from save", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup({ attempts: 5 });
			harness.compState().codeContent = "// saved draft from last session";
			harness.compState().testResults = [{ label: "Restored from LMS", passed: true }];
			harness.compState().score = 1;
			harness.compState().maxScore = 1;
			harness.compState().completed = true;

			// The component publishes no draft on this path: the editor only ever
			// holds the placeholder until the first reply arrives.
			harness.run({
				code: undefined,
				error: "Component configuration not loaded",
				consumesAttempt: false,
				testResults: [],
				score: 0,
				maxScore: 0,
				completed: false,
			});

			const progMsg = harness.postMessages.filter(m => m[0] && m[0].type === "PROGRAMMING_DATA").pop();

			return {
				codeContent: harness.compState().codeContent,
				testResults: harness.compState().testResults,
				score: harness.compState().score,
				completed: harness.compState().completed,
				attempts: harness.compState().attempts,
				replyTestResults: progMsg ? progMsg[0].message.value.testResults : null,
				replyAttemptsLeft: progMsg ? progMsg[0].message.value.attemptsLeft : null,
				replyConsumesAttempt: progMsg ? progMsg[0].message.value.consumesAttempt : null,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.codeContent).toBe("// saved draft from last session");
		expect(result.testResults).toEqual([{ label: "Restored from LMS", passed: true }]);
		expect(result.score).toBe(1);
		expect(result.completed).toBe(true);
		expect(result.attempts).toBeUndefined();
		expect(result.replyTestResults).toEqual([{ label: "Restored from LMS", passed: true }]);
		expect(result.replyAttemptsLeft).toBe(5);
		expect(result.replyConsumesAttempt).toBe(false);
	});

	test("a non-consuming run still saves the edited code", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__codeExec;
			harness.setup({ attempts: 3 });
			harness.run({
				code: 'console.log("hello");',
				testResults: [{ label: "Output matches expected", passed: true }],
				score: 1,
				maxScore: 1,
				completed: true,
			});
			harness.run({
				code: "evil_code();",
				error: 'Code contains banned pattern: "evil_code"',
				consumesAttempt: false,
				testResults: [],
				score: 0,
				maxScore: 0,
				completed: false,
			});

			return {
				codeContent: harness.compState().codeContent,
				testResults: harness.compState().testResults,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.codeContent).toBe("evil_code();");
		expect(result.testResults).toEqual([{ label: "Output matches expected", passed: true }]);
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
