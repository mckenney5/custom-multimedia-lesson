const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("CourseProgramming matching internals", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
		await page.addScriptTag({ path: "../src/vendor/codemirror/lib/codemirror.js" });
		await page.addScriptTag({ path: "../src/vendor/codemirror/mode/javascript/javascript.js" });
		await page.addScriptTag({ path: "../src/internal/sandbox.js" });
		await page.addScriptTag({ path: "../src/internal/components.js" });
		await page.evaluate(() => {
			// A component with learner code loaded and its config in place, so a
			// test can call execute() and read the CODE_EXECUTION payload the
			// parent would receive. Grading is only meaningful through that path:
			// the sandbox is what hands back `actual`, and _autograde is what
			// turns it into a score.
			window.__mkProg = (opts) => {
				const prog = document.createElement("course-programming");
				prog.connectedCallback();
				prog._componentConfig = Object.assign({ timeout: 5000 }, opts.config);
				prog.editor.setValue(opts.code);
				prog.sends = [];
				const orig = prog.send;
				prog.send = function (type, data) {
					orig.call(this, type, data);
					prog.sends.push({ type, data });
				};
				return prog;
			};
			// Grade one string-returning test case and report what the component
			// told the parent, so a test asserts on the score rather than on the
			// normalizer that produced it.
			window.__gradeStringCase = async (expected, code) => {
				const spec = { label: "Returns text", functionName: "f", args: [], expected };
				const prog = window.__mkProg({
					config: { testCases: [spec] },
					code,
				});
				await prog.execute();
				const sent = prog.sends.find((s) => s.type === "CODE_EXECUTION");
				return sent
					? {
						score: sent.data.score,
						maxScore: sent.data.maxScore,
						completed: sent.data.completed,
					}
					: null;
			};
		});
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("identity is answered before the node budget is spent", async () => {
		const equal = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			const a = {};
			const b = {};
			for (let i = 0; i < 15000; i++) {
				a[`k${i}`] = i;
				b[`k${i}`] = i;
			}
			return prog._deepEqual(a, b);
		});

		expect(equal).toBe(true);
	});

	test("a hole in an array does not match a value at that index", async () => {
		const equal = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			const sparse = [];
			sparse[0] = 1;
			sparse[2] = 3;
			return prog._deepEqual(sparse, [1, 2, 3]);
		});

		expect(equal).toBe(false);
	});

	test("nesting past the depth cap fails closed instead of running forever", async () => {
		const equal = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			const build = (depth, leaf) => {
				const root = { leaf };
				let cursor = root;
				for (let i = 0; i < depth; i++) {
					cursor.next = {};
					cursor = cursor.next;
				}
				cursor.leaf = leaf;
				return root;
			};
			return prog._deepEqual(build(40, 1), build(40, 2));
		});

		expect(equal).toBe(false);
	});

	test("an equal structure inside the node budget compares equal", async () => {
		const equal = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			const a = [];
			const b = [];
			for (let i = 0; i < 9000; i++) {
				a.push({ v: i });
				b.push({ v: i });
			}
			return prog._deepEqual(a, b);
		});

		expect(equal).toBe(true);
	});

	test("the node budget fails closed when exhausted, and the budget is why", async () => {
		const verdicts = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			const a = [];
			const b = [];
			for (let i = 0; i < 12000; i++) {
				a.push({ v: i });
				b.push({ v: i });
			}
			return {
				defaultBudget: prog._deepEqual(a, b),
				raisedBudget: prog._deepEqual(a, b, 0, { remaining: 999999999 }),
			};
		});

		expect(verdicts.defaultBudget).toBe(false);
		// Identical pair, identical depth, identical key sets — the only
		// difference is the allowance, so exhaustion is what decided it.
		expect(verdicts.raisedBudget).toBe(true);
	});

	test("only a plain container is compared structurally", async () => {
		const shapes = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			class P {
				constructor() {
					this.a = 1;
				}
			}
			return {
				date: prog._isPlainContainer(new Date(0)),
				regExp: prog._isPlainContainer(/x/),
				nullProto: prog._isPlainContainer(Object.create(null)),
				// A class instance is NOT plain in this realm; it is comparable in
				// practice only because structured clone flattens it on the way out
				// of the iframe, which is pinned by the execute() test.
				classInstance: prog._isPlainContainer(new P()),
			};
		});

		expect(shapes).toEqual({
			date: false,
			regExp: false,
			nullProto: true,
			classInstance: false,
		});
	});

	test("a shared value renders in full and a cycle is labelled", async () => {
		const rows = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			const shared = { z: 9 };
			const cyc = { a: 9 };
			cyc.self = cyc;
			return [
				prog._displayValue({ a: shared, q: shared }),
				prog._displayValue(cyc),
				prog._displayValue("x".repeat(6000)),
			];
		});

		expect(rows[0]).toBe('{"a":{"z":9},"q":{"z":9}}');
		expect(rows[1]).toBe('{"a":9,"self":"[circular]"}');
		expect(rows[2]).toContain("truncated");
		expect(rows[2].length).toBeLessThan(2100);
	});

	// Ticket #69. A return value that differs from `expected` only by blank
	// lines PASSES, and that is confirmed as intended rather than tolerated as
	// a bug: blank-line dropping and whitespace-run collapsing are the #28
	// normalized-exact behavior, and #49 applied that one normalizer to both
	// stdout and test-case return values on purpose. So the looseness is uniform
	// across the two paths, not an accident of the stdout one.
	//
	// This test exists to fail loudly if anyone later gives return values the
	// narrower normalizer #69 declined (CRLF folded, ends trimmed, whitespace
	// runs collapsed, blank lines KEPT). If you are reading a failure here
	// because you made matching stricter, check #69 before assuming the
	// behavior was accidental.
	test("an expected that adds blank lines to the return value still matches", async () => {
		const grade = await page.evaluate(
			() => window.__gradeStringCase("a\n\nb", 'function f() { return "a\\nb"; }'),
		);

		expect(grade).toEqual({ score: 1, maxScore: 1, completed: true });
	});

	// The other direction of the same looseness. A learner who pads the returned
	// text with blank lines has not written a different answer, so this has to
	// keep matching too; the normalizer runs on both sides, and pinning only the
	// `expected` side would leave a one-sided comparison free to drift.
	test("a return value that adds blank lines to expected still matches", async () => {
		const grade = await page.evaluate(
			() => window.__gradeStringCase("a\nb", 'function f() { return "a\\n\\nb"; }'),
		);

		expect(grade).toEqual({ score: 1, maxScore: 1, completed: true });
	});

	// What the blank-line looseness must NOT swallow. #28 normalizes whitespace
	// WITHIN a line; it never merges lines. A return value that is one string
	// where the expected text is two lines is a different answer, and stays a
	// failure. Pinned here, in the same file and beside the looseness it
	// qualifies, so that tightening the normalizer cannot quietly take #28's
	// line structure with it.
	test("a return value whose line structure differs from expected fails", async () => {
		const grade = await page.evaluate(
			() => window.__gradeStringCase("total 5", 'function f() { return "total\\n5"; }'),
		);

		expect(grade).toEqual({ score: 0, maxScore: 1, completed: false });
	});

	// Likewise within a line: collapsing runs of whitespace must not turn the
	// comparison order-insensitive. "b a" and "a b" normalize to themselves.
	test("a return value whose word order differs from expected fails", async () => {
		const grade = await page.evaluate(
			() => window.__gradeStringCase("a b", 'function f() { return "b a"; }'),
		);

		expect(grade).toEqual({ score: 0, maxScore: 1, completed: false });
	});
});
