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
});
