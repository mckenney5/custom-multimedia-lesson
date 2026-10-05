const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

// A string that can only appear in the save file if the learner's source text
// was persisted.
const MARKER = "zzz_learner_source_marker";

test.describe("programming draft: the saved course data", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
		await page.evaluate(() => {
			window.__draft = {
				nonce: Date.now(),
				postMessages: [],
				setup(options) {
					const opts = options || {};
					const pageSpecs = opts.pages || [{
						name: "programming_example.html",
						componentIds: opts.componentIds || ["prog1"],
					}];
					const blankState = () => ({
						completed: false,
						scrolled: false,
						score: 0,
						watchTime: 0,
						attempts: 0,
						videoProgress: 0,
						components: {},
					});

					state.data.pages = pageSpecs.map((spec) => ({
						name: spec.name,
						components: spec.componentIds.map((id) => ({
							id,
							type: "programming",
							starterCode: "// starter",
							language: "javascript",
							timeout: 5000,
						})),
						completionRules: spec.completionRules || opts.completionRules || {},
					}));

					state.data.delta.pagesState = pageSpecs.map((spec) => {
						const pageState = blankState();
						spec.componentIds.forEach((id) => {
							pageState.components[id] = {
								type: "programming",
								testResults: [],
								score: 0,
								maxScore: 1,
								completed: false,
								attempts: 0,
							};
						});
						return pageState;
					});

					state.data.delta.currentPageIndex = 0;
					window.__draft.postMessages = [];
					state.lessonFrame = {
						contentWindow: {
							postMessage: (...args) => {
								window.__draft.postMessages.push(args);
							},
						},
					};
					state.finalizePage = () => {};
					state.pageAPISecret = "TEST_SECRET";
				},
				gotoPage(index) {
					state.data.delta.currentPageIndex = index;
					window.__draft.postMessages = [];
				},
				reset() {
					// Reset reloads the page, which would throw away everything the
					// assertions below need to inspect.
					const hasLms = typeof lms !== "undefined";
					const originalConfirm = window.confirm;
					const originalReload = window.location.reload;
					const originalLmsReset = hasLms ? lms.reset : null;
					window.confirm = () => true;
					window.location.reload = () => {};
					if (hasLms) lms.reset = () => {};
					try {
						state.reset();
					} finally {
						window.confirm = originalConfirm;
						window.location.reload = originalReload;
						if (hasLms) lms.reset = originalLmsReset;
					}
				},
				run(value, componentId) {
					const runValue = Object.assign({
						code: "// code",
						stdout: [],
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
							nonce: window.__draft.nonce++,
						},
						origin: window.location.origin,
					});
				},
				compState(id) {
					return state.data.delta.pagesState[0].components[id || "prog1"];
				},
				compStateOn(pageIndex, id) {
					return state.data.delta.pagesState[pageIndex].components[id];
				},
				lastProgrammingReply() {
					const replies = window.__draft.postMessages.filter(
						(m) => m[0] && m[0].type === "PROGRAMMING_DATA",
					);
					const reply = replies.pop();
					return reply ? reply[0].message.value : null;
				},
				requestData(componentId) {
					state.handleMessage({
						data: {
							type: "GET_PROGRAMMING_DATA",
							message: { id: componentId || "prog1", value: "" },
							code: "TEST_SECRET",
							nonce: window.__draft.nonce++,
						},
						origin: window.location.origin,
					});
					return window.__draft.lastProgrammingReply();
				},
				storageEntries(store) {
					const entries = {};
					Object.keys(store).forEach((key) => {
						entries[key] = store.getItem(key);
					});
					return entries;
				},
				savedBlob() {
					return JSON.stringify(state.serialize());
				},
			};
		});
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("a run leaves the learner's source out of the saved course data", async () => {
		const result = await page.evaluate((marker) => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__draft;
			harness.setup();
			harness.run({
				code: `const ${marker} = 1;\nconsole.log(${marker});`,
				score: 1,
				maxScore: 1,
				completed: true,
			});

			return {
				attempts: harness.compState().attempts,
				score: harness.compState().score,
				blob: harness.savedBlob(),
			};
		}, MARKER);

		// The run is recorded as progress...
		expect(result.error).toBeUndefined();
		expect(result.attempts).toBe(1);
		expect(result.score).toBe(1);
		// ...but nothing that leaves the tab carries the program text.
		expect(result.blob).not.toContain(MARKER);
	});

	test("a run keeps the draft in this tab's session storage, keyed by page and component", async () => {
		const result = await page.evaluate((marker) => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__draft;
			harness.setup();
			harness.run({
				code: `const ${marker} = 1;\nconsole.log(${marker});`,
				score: 1,
				maxScore: 1,
				completed: true,
			});

			return {
				session: harness.storageEntries(window.sessionStorage),
				local: harness.storageEntries(window.localStorage),
			};
		}, MARKER);

		const draft = `const ${MARKER} = 1;\nconsole.log(${MARKER});`;
		expect(result.error).toBeUndefined();
		expect(Object.values(result.session)).toContain(draft);
		expect(Object.values(result.local)).not.toContain(draft);

		// One draft, scoped to the page and the component that produced it.
		const keys = Object.keys(result.session);
		expect(keys.length).toBe(1);
		expect(keys[0]).toContain("programming_example.html");
		expect(keys[0]).toContain("prog1");
	});

	test("the stored draft is offered back when the component asks for its state", async () => {
		const result = await page.evaluate((marker) => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__draft;
			harness.setup();
			const draft = `const ${marker} = 1;`;
			harness.run({ code: draft, score: 1, maxScore: 1, completed: true });

			// A fresh component asking the parent what it already had: the same
			// request the editor makes when a page is (re)loaded.
			return { reply: harness.requestData("prog1") };
		}, MARKER);

		expect(result.error).toBeUndefined();
		expect(result.reply.savedCode).toBe(`const ${MARKER} = 1;`);
	});

	test("a run that publishes no draft leaves the stored one alone", async () => {
		const result = await page.evaluate((marker) => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__draft;
			harness.setup();
			const draft = `const ${marker} = 1;`;
			harness.run({ code: draft, score: 1, maxScore: 1, completed: true });

			// The config-not-loaded path: the editor holds only the pre-reply
			// placeholder, so the component sends no code at all.
			harness.run({
				code: undefined,
				error: "Component configuration not loaded",
				consumesAttempt: false,
				testResults: [],
				score: 0,
				maxScore: 0,
				completed: false,
			});

			return {
				reply: harness.requestData("prog1"),
				storedDrafts: Object.values(harness.storageEntries(window.sessionStorage)),
			};
		}, MARKER);

		expect(result.error).toBeUndefined();
		expect(result.reply.savedCode).toBe(`const ${MARKER} = 1;`);
		expect(result.storedDrafts).toEqual([`const ${MARKER} = 1;`]);
	});

	test("two exercises on one page keep their own drafts", async () => {
		const result = await page.evaluate((marker) => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__draft;
			harness.setup({ componentIds: ["prog1", "prog2"] });
			harness.run({ code: `const first = "${marker}_one";` }, "prog1");
			harness.run({ code: `const second = "${marker}_two";` }, "prog2");

			return {
				first: harness.requestData("prog1").savedCode,
				second: harness.requestData("prog2").savedCode,
			};
		}, MARKER);

		expect(result.error).toBeUndefined();
		expect(result.first).toBe(`const first = "${MARKER}_one";`);
		expect(result.second).toBe(`const second = "${MARKER}_two";`);
	});

	test("the same exercise id on two pages keeps two separate drafts", async () => {
		const result = await page.evaluate((marker) => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__draft;
			harness.setup({
				pages: [
					{ name: "first_page.html", componentIds: ["prog1"] },
					{ name: "second_page.html", componentIds: ["prog1"] },
				],
			});
			harness.run({ code: `const onPageOne = "${marker}_one";` }, "prog1");
			harness.gotoPage(1);
			harness.run({ code: `const onPageTwo = "${marker}_two";` }, "prog1");

			const second = harness.requestData("prog1").savedCode;
			harness.gotoPage(0);

			return { first: harness.requestData("prog1").savedCode, second };
		}, MARKER);

		expect(result.error).toBeUndefined();
		expect(result.first).toBe(`const onPageOne = "${MARKER}_one";`);
		expect(result.second).toBe(`const onPageTwo = "${MARKER}_two";`);
	});

	test("an exercise that has never been run is sent no savedCode", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__draft;
			harness.setup({ componentIds: ["prog1", "prog2"] });

			return { reply: harness.requestData("prog2") };
		});

		expect(result.error).toBeUndefined();
		// Nothing to restore, so the component must be told nothing: it falls
		// back to starterCode only when savedCode is neither present nor null.
		expect(result.reply.savedCode ?? "no saved draft").toBe("no saved draft");
		expect(result.reply.starterCode).toBe("// starter");
	});

	test("a draft that cannot be stored costs the draft, not the run", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__draft;
			harness.setup({ completionRules: { attempts: 3 } });

			const original = Storage.prototype.setItem;
			let attemptedKey = null;
			Storage.prototype.setItem = function(key) {
				attemptedKey = key;
				throw new Error("storage unavailable");
			};
			try {
				harness.run({
					code: "console.log('stored nowhere');",
					score: 1,
					maxScore: 1,
					completed: true,
				});
			} finally {
				Storage.prototype.setItem = original;
			}

			return {
				attemptedKey,
				attempts: harness.compState().attempts,
				score: harness.compState().score,
				completed: harness.compState().completed,
				reply: harness.lastProgrammingReply(),
			};
		});

		expect(result.error).toBeUndefined();
		// The store was tried and refused...
		expect(result.attemptedKey).toContain("prog1");
		// ...and the learner still gets credit for the run they just made.
		expect(result.attempts).toBe(1);
		expect(result.score).toBe(1);
		expect(result.completed).toBe(true);
		expect(result.reply).not.toBeNull();
		expect(result.reply.attemptsLeft).toBe(2);
		expect(result.reply.score).toBe(1);
	});

	test("reset takes the stored draft with it", async () => {
		const result = await page.evaluate((marker) => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__draft;
			harness.setup();
			const draft = `const ${marker} = 1;`;
			harness.run({ code: draft, score: 1, maxScore: 1, completed: true });

			// Not ours to clear.
			window.sessionStorage.setItem("unrelated_note", "keep me");

			harness.reset();

			return {
				session: harness.storageEntries(window.sessionStorage),
				reply: harness.requestData("prog1"),
			};
		}, MARKER);

		expect(result.error).toBeUndefined();
		// The learner's code is gone from the tab, not just from the save file:
		// a reload after a reset must not hand back what they were told is gone.
		expect(Object.values(result.session)).not.toContain(`const ${MARKER} = 1;`);
		expect(result.reply.savedCode ?? "no saved draft").toBe("no saved draft");
		// Only our own entries are cleared.
		expect(result.session.unrelated_note).toBe("keep me");
	});

	test("a save written before the draft moved does not bring the old code back", async () => {
		const result = await page.evaluate((marker) => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const harness = window.__draft;
			harness.setup();
			harness.run({ code: `const fresh = "${marker}_fresh";`, score: 1, maxScore: 1 });

			// A save from before the draft moved: the learner's source is sitting
			// in the page blob, where nothing will ever overwrite it again. The
			// blob is the last slot of the last page.
			const saved = state.serialize();
			saved[saved.length - 1] = JSON.stringify({
				prog1: {
					type: "programming",
					codeContent: `const legacy = "${marker}_legacy";`,
					testResults: [{ label: "Restored from LMS", passed: true }],
					score: 1,
					maxScore: 1,
					completed: true,
					attempts: 2,
				},
			});

			// Arrive at the page fresh, the way a reload does, then restore.
			const compState = harness.compState();
			delete compState.codeContent;
			compState.testResults = [];
			compState.score = 0;
			compState.completed = false;
			compState.attempts = 0;
			state.deserialize(saved);

			return {
				codeContent: harness.compState().codeContent,
				attempts: harness.compState().attempts,
				blob: harness.savedBlob(),
			};
		}, MARKER);

		expect(result.error).toBeUndefined();
		// Everything else in the save is still restored...
		expect(result.attempts).toBe(2);
		// ...but the source it used to carry is not, and does not come back on the
		// next save either.
		expect(result.codeContent).toBeUndefined();
		expect(result.blob).not.toContain(`${MARKER}_legacy`);
	});
});
