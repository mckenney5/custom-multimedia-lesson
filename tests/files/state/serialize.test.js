const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.serialize: fail-soft persistence", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
		await page.evaluate(() => {
			window.__ser = {
				nonce: Date.now(),
				setup() {
					state.data.pages = [
						{
							name: "test.html",
							components: [{ id: "prog1", type: "programming", starterCode: "// starter" }],
							completionRules: {},
						},
					];
					state.data.delta.pagesState = [
						{
							completed: false,
							scrolled: false,
							score: 0,
							watchTime: 0,
							attempts: 0,
							videoProgress: 0,
							components: {
								prog1: {
									type: "programming",
									testResults: [],
									score: 0,
									maxScore: 0,
									completed: false,
								},
							},
						},
					];
					state.data.delta.currentPageIndex = 0;
					state.lessonFrame = {
						contentWindow: { postMessage: () => {} },
					};
					state.finalizePage = () => {};
					state.pageAPISecret = "TEST_SECRET";
					window.__ser.nonce = Date.now();
				},
				run(value) {
					state.handleMessage({
						data: {
							type: "CODE_EXECUTION",
							message: { id: "prog1", value },
							code: "TEST_SECRET",
							nonce: window.__ser.nonce++,
						},
						origin: window.location.origin,
					});
				},
			};
		});
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("serialize() returns an array when a component's testResults hold a circular learner return value", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			window.__ser.setup();
			const circular = { a: 1 };
			circular.self = circular;
			window.__ser.run({
				code: "function make() { var o = { a: 1 }; o.self = o; return o; }",
				stdout: [],
				testResults: [
					{
						label: "returns object",
						passed: false,
						expected: { a: 1 },
						actual: circular,
						error: null,
					},
				],
				score: 0,
				maxScore: 1,
				completed: false,
			});

			try {
				const arr = state.serialize();
				return { ok: true, isArray: Array.isArray(arr), length: arr.length };
			} catch (e) {
				return { ok: false, error: String(e && e.message || e) };
			}
		});

		expect(result.error).toBeUndefined();
		expect(result.ok, `serialize threw: ${result.error}`).toBe(true);
		expect(result.isArray).toBe(true);
		// 3 globals + 7 per page
		expect(result.length).toBe(10);
	});

	test("a circular-return run through execute() reaches pageDelta, serializes, and save() resolves", async () => {
		await page.addScriptTag({ path: "../src/vendor/codemirror/lib/codemirror.js" });
		await page.addScriptTag({ path: "../src/vendor/codemirror/mode/javascript/javascript.js" });
		await page.addScriptTag({ path: "../src/internal/sandbox.js" });
		await page.addScriptTag({ path: "../src/internal/components.js" });

		const result = await page.evaluate(async () => {
			if (typeof state === "undefined") return { error: "state not defined" };

			window.__ser.setup();

			// The wire children.js normally provides: component send() ->
			// state.handleMessage with the handshake code and a fresh nonce.
			let wireNonce = 0;
			window.child = {
				send(type, payload) {
					state.handleMessage({
						data: {
							type,
							message: payload,
							code: state.pageAPISecret,
							nonce: Date.now() - (++wireNonce),
						},
						origin: window.location.origin,
					});
				},
			};

			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog1");
			prog.connectedCallback();
			prog._componentConfig = {
				timeout: 5000,
				testCases: [
					{ label: "returns object", functionName: "make", args: [], expected: { a: 1 } },
				],
			};
			prog.editor.setValue("function make() { var o = { a: 1 }; o.self = o; return o; }");

			await prog.execute();

			const compState = state.data.delta.pagesState[0].components.prog1;
			const storedResult = compState.testResults && compState.testResults[0];
			let serializeError = null;
			let serializeLength = 0;
			try {
				const arr = state.serialize();
				serializeLength = arr.length;
			} catch (e) {
				serializeError = String((e && e.message) || e);
			}

			let saveError = null;
			try {
				await state.save();
			} catch (e) {
				saveError = String((e && e.message) || e);
			}

			return {
				storedLabel: storedResult ? storedResult.label : null,
				// The cycle must have survived the sandbox structured clone and
				// every hop, or this test would pass without exercising the bug.
				actualIsCircular: Boolean(
					storedResult &&
					storedResult.actual &&
					storedResult.actual.self === storedResult.actual,
				),
				storedScore: compState.score,
				storedMaxScore: compState.maxScore,
				storedAttempts: compState.attempts,
				serializeError,
				serializeLength,
				saveError,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.storedLabel).toBe("returns object");
		expect(result.actualIsCircular).toBe(true);
		expect(result.storedScore).toBe(0);
		expect(result.storedMaxScore).toBe(1);
		expect(result.storedAttempts).toBe(1);
		expect(result.serializeError).toBeNull();
		expect(result.serializeLength).toBe(10);
		expect(result.saveError).toBeNull();
	});

	test("save -> loadSave restores a page whose testResults were circular", async () => {
		const result = await page.evaluate(async () => {
			if (typeof state === "undefined") return { error: "state not defined" };

			window.__ser.setup();
			const circular = { a: 1 };
			circular.self = circular;
			window.__ser.run({
				code: "// circular draft",
				stdout: [],
				testResults: [
					{
						label: "returns object",
						passed: false,
						expected: { a: 1 },
						actual: circular,
						error: null,
					},
				],
				score: 0,
				maxScore: 1,
				completed: false,
			});

			const saveError = await state.save().then(() => null, (e) => String((e && e.message) || e));

			// Simulate arriving at the page fresh: wipe the component state the
			// reload is expected to bring back.
			const compState = state.data.delta.pagesState[0].components.prog1;
			compState.testResults = [];
			compState.score = 0;
			compState.maxScore = 0;

			const loadError = await state.loadSave().then(() => null, (e) => String((e && e.message) || e));

			const restored = state.data.delta.pagesState[0].components.prog1;

			// The persisted page blob must still be valid JSON after the round trip.
			let blobOk = false;
			let blobLabel = null;
			try {
				// Layout mirrors deserialize(): 3 globals, then per page
				// 6 numeric fields + 1 JSON string — page 0's JSON slot is index 9.
				const GLOBALS_COUNT = 3;
				const ITEMS_PER_PAGE = 7;
				const parsed = JSON.parse(state.serialize()[GLOBALS_COUNT + ITEMS_PER_PAGE - 1]);
				blobOk = true;
				blobLabel = parsed.prog1 && parsed.prog1.testResults
					? (parsed.prog1.testResults[0] || {}).label
					: null;
			} catch (e) {
				blobLabel = String((e && e.message) || e);
			}

			return {
				saveError,
				loadError,
				maxScore: restored.maxScore,
				resultLabel: restored.testResults && restored.testResults[0]
					? restored.testResults[0].label
					: null,
				blobOk,
				blobLabel,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.saveError).toBeNull();
		expect(result.loadError).toBeNull();
		expect(result.maxScore).toBe(1);
		expect(result.resultLabel).toBe("returns object");
		expect(result.blobOk).toBe(true);
		expect(result.blobLabel).toBe("returns object");
	});

	test("a BigInt-return run serializes: actual is normalised and save() resolves", async () => {
		await page.addScriptTag({ path: "../src/vendor/codemirror/lib/codemirror.js" });
		await page.addScriptTag({ path: "../src/vendor/codemirror/mode/javascript/javascript.js" });
		await page.addScriptTag({ path: "../src/internal/sandbox.js" });
		await page.addScriptTag({ path: "../src/internal/components.js" });

		const result = await page.evaluate(async () => {
			if (typeof state === "undefined") return { error: "state not defined" };

			window.__ser.setup();

			let wireNonce = 0;
			window.child = {
				send(type, payload) {
					state.handleMessage({
						data: {
							type,
							message: payload,
							code: state.pageAPISecret,
							nonce: Date.now() - (++wireNonce),
						},
						origin: window.location.origin,
					});
				},
			};

			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog1");
			prog.connectedCallback();
			prog._componentConfig = {
				timeout: 5000,
				testCases: [
					{ label: "bigint", functionName: "f", args: [], expected: 1 },
				],
			};
			prog.editor.setValue("function f() { return 10n; }");

			await prog.execute();

			const compState = state.data.delta.pagesState[0].components.prog1;
			const storedResult = compState.testResults && compState.testResults[0];
			let serializeError = null;
			let blobActual = null;
			try {
				const arr = state.serialize();
				const GLOBALS_COUNT = 3;
				const ITEMS_PER_PAGE = 7; // 6 numbers + 1 JSON string (mirrors deserialize)
				blobActual = JSON.parse(arr[GLOBALS_COUNT + ITEMS_PER_PAGE - 1])
					.prog1.testResults[0].actual;
			} catch (e) {
				serializeError = String((e && e.message) || e);
			}

			const saveError = await state.save().then(() => null, (e) => String((e && e.message) || e));

			return {
				// The BigInt must survive the sandbox structured clone and every
				// hop, or this test would not exercise the reported repro.
				actualIsBigInt: Boolean(storedResult && typeof storedResult.actual === "bigint"),
				serializeError,
				blobActual,
				saveError,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.actualIsBigInt).toBe(true);
		expect(result.serializeError).toBeNull();
		expect(result.blobActual).toBe("10");
		expect(result.saveError).toBeNull();
	});

	test("serialize() fails soft on a payload JSON cannot represent (throwing toJSON), keeping layout and a valid blob", async () => {
		const result = await page.evaluate(async () => {
			if (typeof state === "undefined") return { error: "state not defined" };

			window.__ser.setup();

			// toJSON runs before any replacer policy can see the value, so no
			// normalisation can represent this payload — only fail-soft can.
			const hostile = {
				label: "returns hostile",
				passed: false,
				expected: 1,
				error: null,
				toJSON() {
					throw new Error("toJSON boom");
				},
			};
			window.__ser.run({
				code: "// hostile draft",
				stdout: [],
				testResults: [hostile],
				score: 0,
				maxScore: 1,
				completed: false,
			});

			let serializeError = null;
			let length = 0;
			let blob = null;
			try {
				const arr = state.serialize();
				length = arr.length;
				// Layout mirrors deserialize(): 3 globals, then per page
				// 6 numeric fields + 1 JSON string — page 0's JSON slot is index 9.
				const GLOBALS_COUNT = 3;
				const ITEMS_PER_PAGE = 7;
				blob = JSON.parse(arr[GLOBALS_COUNT + ITEMS_PER_PAGE - 1]);
			} catch (e) {
				serializeError = String((e && e.message) || e);
			}

			const saveError = await state.save().then(() => null, (e) => String((e && e.message) || e));
			const loadError = await state.loadSave().then(() => null, (e) => String((e && e.message) || e));

			return {
				serializeError,
				length,
				blob,
				saveError,
				loadError,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.serializeError).toBeNull();
		expect(result.length).toBe(10);
		expect(result.blob).not.toBeNull();
		expect(typeof result.blob.__serializeError).toBe("string");
		expect(result.saveError).toBeNull();
		expect(result.loadError).toBeNull();
	});

	test("_stringifyCycleSafe: a shared reference stays expanded after a BigInt sibling", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			// The pop loop must run before the BigInt branch returns, or
			// stale ancestors would mark the later `c` reference circular.
			const shared = { x: 1 };
			const afterBigInt = state._stringifyCycleSafe({ a: shared, b: 10n, c: shared });

			// A BigInt inside a genuinely cyclic object must still mark only
			// the cycle edge.
			const mixed = { n: 1n };
			mixed.self = mixed;
			const mixedOut = state._stringifyCycleSafe(mixed);

			return { afterBigInt, mixedOut };
		});

		expect(result.error).toBeUndefined();
		expect(result.afterBigInt).toBe('{"a":{"x":1},"b":"10","c":{"x":1}}');
		expect(result.mixedOut).toBe('{"n":"1","self":"[circular]"}');
	});

	test("a fail-soft page 0 does not damage page 1's metrics or blob", async () => {
		const result = await page.evaluate(async () => {
			if (typeof state === "undefined") return { error: "state not defined" };

			window.__ser.setup();

			// Page 1: fully populated — the fail-soft on page 0 must not touch it.
			state.data.pages.push({
				name: "two.html",
				components: [{ id: "prog1", type: "programming", starterCode: "// p2" }],
				completionRules: {},
			});
			state.data.delta.pagesState.push({
				completed: true,
				scrolled: true,
				score: 0.75,
				watchTime: 42,
				attempts: 2,
				videoProgress: 0.5,
				components: {
					prog1: {
						type: "programming",
						testResults: [{ label: "page 2 result", passed: true }],
						score: 3,
						maxScore: 3,
						completed: true,
					},
				},
			});

			// Poison page 0 with a value JSON cannot represent.
			const hostile = {
				label: "hostile",
				passed: false,
				expected: 1,
				error: null,
				toJSON() {
					throw new Error("boom");
				},
			};
			window.__ser.run({
				code: "// hostile",
				stdout: [],
				testResults: [hostile],
				score: 0,
				maxScore: 1,
				completed: false,
			});

			const saveError = await state.save().then(() => null, (e) => String((e && e.message) || e));

			const GLOBALS_COUNT = 3;
			const ITEMS_PER_PAGE = 7; // 6 numbers + 1 JSON string (mirrors deserialize)
			let length = 0;
			let page0Blob = null;
			let page1Metrics = null;
			let page1ResultLabel = null;
			let readError = null;
			try {
				const arr = state.serialize();
				length = arr.length;
				page0Blob = JSON.parse(arr[GLOBALS_COUNT + ITEMS_PER_PAGE - 1]);
				page1Metrics = arr.slice(
					GLOBALS_COUNT + ITEMS_PER_PAGE,
					GLOBALS_COUNT + 2 * ITEMS_PER_PAGE - 1,
				);
				const page1Blob = JSON.parse(arr[GLOBALS_COUNT + 2 * ITEMS_PER_PAGE - 1]);
				page1ResultLabel = page1Blob.prog1 && page1Blob.prog1.testResults
					? page1Blob.prog1.testResults[0].label
					: null;
			} catch (e) {
				readError = String((e && e.message) || e);
			}

			return { saveError, length, page0Blob, page1Metrics, page1ResultLabel, readError };
		});

		expect(result.error).toBeUndefined();
		expect(result.readError).toBeNull();
		expect(result.saveError).toBeNull();
		expect(result.length).toBe(17); // 3 globals + 2 pages * 7
		expect(typeof result.page0Blob.__serializeError).toBe("string");
		// completed, scrolled, score*100, watchTime, attempts, videoProgress*100
		expect(result.page1Metrics).toEqual([1, 1, 75, 42, 2, 50]);
		expect(result.page1ResultLabel).toBe("page 2 result");
	});

	test("fail-soft -> reload -> healthy run: marker is not restored and the recovered blob is clean", async () => {
		const result = await page.evaluate(async () => {
			if (typeof state === "undefined") return { error: "state not defined" };

			window.__ser.setup();

			// Layout mirrors deserialize(): 3 globals, then per page
			// 6 numeric fields + 1 JSON string — page 0's JSON slot is index 9.
			const GLOBALS_COUNT = 3;
			const ITEMS_PER_PAGE = 7;
			const slot = GLOBALS_COUNT + ITEMS_PER_PAGE - 1;

			// 1. Fail-soft save: the page's state cannot be encoded.
			const hostile = {
				label: "hostile",
				passed: false,
				expected: 1,
				error: null,
				toJSON() {
					throw new Error("boom");
				},
			};
			window.__ser.run({
				code: "// hostile",
				stdout: [],
				testResults: [hostile],
				score: 0,
				maxScore: 1,
				completed: false,
			});
			const failSave = await state.save().then(() => null, (e) => String((e && e.message) || e));
			let failBlob = null;
			try {
				failBlob = JSON.parse(state.serialize()[slot]);
			} catch (e) {
				failBlob = { error: String((e && e.message) || e) };
			}

			// 2. Reload.
			const loadError = await state.loadSave().then(() => null, (e) => String((e && e.message) || e));
			const markerAfterLoad = Object.prototype.hasOwnProperty.call(
				state.data.delta.pagesState[0].components,
				"__serializeError",
			);

			// 3. Learner fixes their code and re-runs with healthy results.
			window.__ser.run({
				code: "// fixed code",
				stdout: [],
				testResults: [
					{ label: "ok", passed: true, expected: 1, actual: 1, error: null },
				],
				score: 1,
				maxScore: 1,
				completed: true,
			});
			let recoverBlob = null;
			let recoverError = null;
			try {
				recoverBlob = JSON.parse(state.serialize()[slot]);
			} catch (e) {
				recoverError = String((e && e.message) || e);
			}
			const recoverSave = await state.save().then(() => null, (e) => String((e && e.message) || e));

			return { failSave, failBlob, loadError, markerAfterLoad, recoverError, recoverBlob, recoverSave };
		});

		expect(result.error).toBeUndefined();
		expect(result.failSave).toBeNull();
		expect(result.loadError).toBeNull();
		expect(result.recoverError).toBeNull();
		expect(result.recoverSave).toBeNull();
		// The failure itself is recorded...
		expect(typeof result.failBlob.__serializeError).toBe("string");
		// ...but the marker must not outlive it: dropped at load, and the
		// recovered blob carries only the healthy component data.
		expect(result.markerAfterLoad).toBe(false);
		expect(result.recoverBlob.__serializeError).toBeUndefined();
		expect(result.recoverBlob.prog1.testResults[0].label).toBe("ok");
		expect(result.recoverBlob.prog1.score).toBe(1);
	});

	test("a save carrying a stale marker beside real data keeps the data and drops the marker", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			window.__ser.setup();

			// The other shape the marker reaches a save file in: not the whole blob,
			// but a valid component *beside* the marker. That is what a build which
			// merged the key wrote, so it is what every learner's file still holds —
			// the test above can only produce the marker-only shape.
			const saved = state.serialize();
			saved[saved.length - 1] = JSON.stringify({
				prog1: {
					type: "programming",
					testResults: [
						{ label: "restored from the LMS", passed: true, expected: 1, actual: 1, error: null },
					],
					score: 1,
					maxScore: 1,
					completed: true,
					attempts: 2,
				},
				__serializeError: "boom",
			});

			// Arrive at the page the way a reload does, then restore the save.
			const before = state.data.delta.pagesState[0].components.prog1;
			before.score = 0;
			before.completed = false;
			before.attempts = 0;
			before.testResults = [];

			state.deserialize(saved);

			const components = state.data.delta.pagesState[0].components;

			return {
				componentKeys: Object.keys(components),
				score: components.prog1.score,
				completed: components.prog1.completed,
				attempts: components.prog1.attempts,
				resultLabel: components.prog1.testResults[0].label,
				// And the next save of this page, which is where a resident marker
				// would come back to life.
				blob: JSON.parse(state.serialize()[saved.length - 1]),
			};
		});

		expect(result.error).toBeUndefined();
		// Dropping the marker must not cost the component it was sitting next to.
		expect(result.score).toBe(1);
		expect(result.completed).toBe(true);
		expect(result.attempts).toBe(2);
		expect(result.resultLabel).toBe("restored from the LMS");
		// The marker never becomes resident...
		expect(result.componentKeys).toEqual(["prog1"]);
		// ...so the next save is clean, with no trace of it.
		expect(result.blob.__serializeError).toBeUndefined();
		expect(Object.keys(result.blob)).toEqual(["prog1"]);
		expect(result.blob.prog1.score).toBe(1);
	});
});
