const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

// The budgets that bound a payload live in the source modules, so they are read
// from there rather than restated here. A restated literal is how this file came
// to cite a suspend_data limit that no longer applied, and a declaration that
// cannot be found fails the file loudly at load instead of leaving a silently
// stale bound. Numbers are what get derived: the two marker strings are
// deliberately written out where they are asserted, because what a learner is
// shown is a fact to pin and mirroring it from the source would make the
// assertion true by construction. STDOUT_SENTINEL is read only because its
// LENGTH is a term in the bound below; its exact text is pinned literally in
// tests/files/sandbox/sandbox-evaluate.test.js.
const SRC_DIR = path.join(__dirname, "..", "..", "..", "src", "internal");
const sourceText = {};

const sourceLiteral = (file, name) => {
	if (!(file in sourceText)) {
		sourceText[file] = fs.readFileSync(path.join(SRC_DIR, file), "utf8");
	}
	const match = sourceText[file].match(new RegExp(`const ${name} = ("[^"]*"|\\d+);`));
	if (!match) {
		throw new Error(`src/internal/${file} no longer declares \`const ${name} = <literal>;\``);
	}
	return JSON.parse(match[1]);
};

const sandboxLiteral = (name) => sourceLiteral("sandbox.js", name);
const componentLiteral = (name) => sourceLiteral("components.js", name);

const MAX_STDOUT_LINES = sandboxLiteral("MAX_STDOUT_LINES");
const MAX_STDOUT_CHARS = sandboxLiteral("MAX_STDOUT_CHARS");
const MAX_OUTPUT_CHARS = componentLiteral("MAX_OUTPUT_CHARS");
const STDOUT_SENTINEL = sandboxLiteral("STDOUT_SENTINEL");

// The worst case the capture path can hand the parent, as the persisted grading
// row sees it. MEASURED: 10519 chars. Content is capped at MAX_STDOUT_CHARS and
// the sentinel is pushed outside that budget, so the sum is MAX_STDOUT_CHARS
// plus the sentinel. With the line cap already full, the log that trips it still
// pushes the part of the line that fits (sandbox.js), so stdout holds
// MAX_STDOUT_LINES + 2 entries and the join turns those into
// MAX_STDOUT_LINES + 1 newlines. The empty entry _autograde appends for an
// undefined returnValue is dropped by the blank-line filter in
// _normalizeOutput, so it contributes no characters.
const MAX_ACTUAL_CHARS =
	MAX_STDOUT_CHARS + STDOUT_SENTINEL.length + MAX_STDOUT_LINES + 1;

// 499 lines of 20 characters fill 9980 and one 19 character line brings that to
// 9999, so the line cap is now full with a single character of budget left. The
// last log therefore takes the partial-line path, which is the shape that
// maximises the entry count and the joined length at the same time.
const WORST_CASE_FLOOD =
	`for (var i = 0; i < ${MAX_STDOUT_LINES - 1}; i++) console.log("${"x".repeat(20)}");` +
	`console.log("${"y".repeat(MAX_STDOUT_CHARS - 1 - (MAX_STDOUT_LINES - 1) * 20)}");` +
	`console.log("${"z".repeat(64)}");`;

test.describe("CourseProgramming execute() wiring", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
		await page.addScriptTag({ path: "../src/vendor/codemirror/lib/codemirror.js" });
		await page.addScriptTag({ path: "../src/vendor/codemirror/mode/javascript/javascript.js" });
		await page.addScriptTag({ path: "../src/internal/sandbox.js" });
		await page.addScriptTag({ path: "../src/internal/components.js" });
		await page.evaluate(() => {
			window.__mkProg = (opts = {}) => {
				const prog = document.createElement("course-programming");
				if (opts.id) prog.setAttribute("id", opts.id);
				prog.connectedCallback();
				prog._componentConfig = Object.assign({ timeout: 5000 }, opts.config);
				if (opts.attemptsLeft !== undefined) prog.attemptsLeft = opts.attemptsLeft;
				prog.editor.setValue(opts.code || "42 + 1");
				prog.sends = [];
				const orig = prog.send;
				prog.send = function (type, data) {
					orig.call(this, type, data);
					prog.sends.push({ type, data });
					if (opts.onSend) opts.onSend(type, data);
				};
				return prog;
			};
		});
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("a worst-case flood sends a bounded stdout payload to the parent", async () => {
		const result = await page.evaluate(async (code) => {
			const prog = window.__mkProg({
				config: { expectedOutput: "line 0" },
				code: code,
			});
			await prog.execute();
			const sent = prog.sends.find(s => s.type === "CODE_EXECUTION");
			return {
				stdoutLines: sent.data.stdout.length,
				contentChars: sent.data.stdout.reduce((sum, line) => sum + line.length, 0),
				lastLine: sent.data.stdout[sent.data.stdout.length - 1],
				returnValueIsUndefined: sent.data.returnValue === undefined,
				actual: sent.data.testResults[0].actual.length,
				score: sent.data.score,
			};
		}, WORST_CASE_FLOOD);

		expect(result.stdoutLines).toBe(MAX_STDOUT_LINES + 2);
		expect(result.contentChars).toBe(MAX_STDOUT_CHARS + STDOUT_SENTINEL.length);
		expect(result.lastLine).toBe(STDOUT_SENTINEL);
		// The bound above assumes the run returned nothing, so the empty entry
		// _autograde appends stays filtered out of the normalized string.
		expect(result.returnValueIsUndefined).toBe(true);
		expect(result.actual).toBeLessThanOrEqual(MAX_ACTUAL_CHARS);
		expect(result.score).toBe(0);
	});

	test("a huge return value cannot flood the output panel", async () => {
		const dump = await page.evaluate(async () => {
			const prog = window.__mkProg({ code: "'y'.repeat(1000000)" });
			await prog.execute();
			return prog.querySelector("#prog-output-text").textContent;
		});

		// MAX_OUTPUT_CHARS is components.js's own panel budget, read from the
		// source above so it cannot go stale here. The marker stays written out:
		// what the learner is shown is asserted as a fact on the next line, and
		// mirroring it from the source would make that assertion true by
		// construction.
		expect(dump.length).toBeLessThanOrEqual(MAX_OUTPUT_CHARS + "\n… (truncated)".length);
		expect(dump).toMatch(/^y+\n… \(truncated\)$/);
	});

	test("a flooding run shows a bounded output panel with the truncation sentinel visible", async () => {
		const dump = await page.evaluate(async () => {
			const prog = window.__mkProg({
				code: "for (var i = 0; i < 2000; i++) console.log('line ' + i);",
			});
			await prog.execute();
			return prog.querySelector("#prog-output-text").textContent;
		});

		const lines = dump.split("\n");
		// Short lines trip the line cap well before the character cap, so this
		// flood stays inside the panel budget and the capture sentinel really is
		// the last thing visible. The bound is the worst case over any flood,
		// since the partial line the character-cap path keeps is one entry more.
		expect(lines.length).toBeLessThanOrEqual(MAX_STDOUT_LINES + 2);
		expect(lines[0]).toBe("line 0");
		expect(lines[lines.length - 1]).toBe(STDOUT_SENTINEL);
	});

	test("error-free run of a component with no expectedOutput or testCases completes", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg({ code: "1 + 1" });
			await prog.execute();
			const sent = prog.sends.find(s => s.type === "CODE_EXECUTION");
			return sent ? sent.data : null;
		});

		expect(result.maxScore).toBe(0);
		expect(result.score).toBe(0);
		expect(result.completed).toBe(true);
	});

	test("no-criteria run that throws an error does not complete", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg({ code: 'throw new Error("kaboom")' });
			await prog.execute();
			const sent = prog.sends.find(s => s.type === "CODE_EXECUTION");
			return sent ? sent.data : null;
		});

		expect(result.maxScore).toBe(0);
		expect(result.error).toContain("kaboom");
		expect(result.completed).toBe(false);
	});

	test("execute() calls sandbox.evaluate and returns result via send", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg();
			await prog.execute();
			const sent = prog.sends.find(s => s.type === "CODE_EXECUTION");
			return sent ? sent.data : null;
		});

		expect(result.code).toBe("42 + 1");
		expect(result.returnValue).toBe(43);
		expect(result.error).toBeNull();
		expect(result.stdout).toEqual([]);
	});

	test("output with extra internal spaces still matches expectedOutput", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: { expectedOutput: "Hello world" },
				code: 'console.log("Hello  world")',
			});
			await prog.execute();
			const sent = prog.sends.find(s => s.type === "CODE_EXECUTION");
			return sent ? sent.data : null;
		});

		expect(result.score).toBe(1);
		expect(result.maxScore).toBe(1);
		expect(result.completed).toBe(true);
	});

	test("failed result rows show expected and got", async () => {
		const rows = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: {
					expectedOutput: "Hello world",
					testCases: [{ label: "Greets", functionName: "greet", args: [], expected: "hi" }],
				},
				code: 'console.log("Goodbye"); function greet() { return "no"; }',
			});
			await prog.execute();
			return Array.from(prog.querySelectorAll("#prog-results-list .prog-test-result")).map(
				(el) => el.textContent,
			);
		});

		expect(rows).toHaveLength(2);
		expect(rows[0]).toContain("expected: Hello world");
		expect(rows[0]).toContain("got: Goodbye");
		expect(rows[1]).toContain("expected: hi");
		expect(rows[1]).toContain("got: no");
	});

	test("failed result row shows the thrown error", async () => {
		const rows = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: { expectedOutput: "Hello" },
				code: 'throw new Error("kaboom")',
			});
			await prog.execute();
			return Array.from(prog.querySelectorAll("#prog-results-list .prog-test-result")).map(
				(el) => el.textContent,
			);
		});

		expect(rows[0]).toContain("expected: Hello");
		expect(rows[0]).toContain("error: kaboom");
	});

	test("failed test case rows show expected and error when learner code throws", async () => {
		const rows = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: {
					testCases: [{ label: "Greets", functionName: "greet", args: [], expected: "hi" }],
				},
				code: 'throw new Error("kaboom")',
			});
			await prog.execute();
			return Array.from(prog.querySelectorAll("#prog-results-list .prog-test-result")).map(
				(el) => el.textContent,
			);
		});

		expect(rows).toHaveLength(1);
		expect(rows[0]).toContain("expected: hi");
		expect(rows[0]).toContain("error: kaboom");
		expect(rows[0]).not.toContain("got:");
	});

	test("a test case return value with trailing whitespace still passes", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: {
					testCases: [{ label: "Greets", functionName: "greet", args: [], expected: "hi" }],
				},
				code: 'function greet() { return "hi  "; }',
			});
			await prog.execute();
			const sent = prog.sends.find((s) => s.type === "CODE_EXECUTION");
			return sent ? sent.data : null;
		});

		expect(result.score).toBe(1);
		expect(result.maxScore).toBe(1);
		expect(result.completed).toBe(true);
	});

	test("a test case whose text genuinely differs still fails", async () => {
		const rows = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: {
					testCases: [{ label: "Greets", functionName: "greet", args: [], expected: "hi" }],
				},
				code: 'function greet() { return "hi there"; }',
			});
			await prog.execute();
			return Array.from(prog.querySelectorAll("#prog-results-list .prog-test-result")).map(
				(el) => el.textContent,
			);
		});

		expect(rows[0]).toContain("expected: hi");
		expect(rows[0]).toContain("got: hi there");
	});

	test("a test case return value with CRLF and a trailing newline still passes", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: {
					testCases: [{ label: "Two lines", functionName: "pair", args: [], expected: "hi\nthere" }],
				},
				code: 'function pair() { return "hi\\r\\nthere\\n"; }',
			});
			await prog.execute();
			const sent = prog.sends.find((s) => s.type === "CODE_EXECUTION");
			return sent ? sent.data : null;
		});

		expect(result.score).toBe(1);
		expect(result.maxScore).toBe(1);
	});

	test("a passing test case row shows no expected/got detail", async () => {
		const rows = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: {
					testCases: [{ label: "Greets", functionName: "greet", args: [], expected: "hi" }],
				},
				code: 'function greet() { return "hi  "; }',
			});
			await prog.execute();
			return Array.from(prog.querySelectorAll("#prog-results-list .prog-test-result")).map(
				(el) => el.textContent,
			);
		});

		expect(rows[0]).toContain("Greets");
		expect(rows[0]).not.toContain("got:");
		expect(rows[0]).not.toContain("expected:");
	});

	test("an object return value that does not match still fails", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: {
					testCases: [{ label: "Object", functionName: "make", args: [], expected: { a: 2 } }],
				},
				code: "function make() { return { a: 1 }; }",
			});
			await prog.execute();
			const sent = prog.sends.find((s) => s.type === "CODE_EXECUTION");
			return sent ? sent.data : null;
		});

		expect(result.score).toBe(0);
		expect(result.maxScore).toBe(1);
	});

	test("a numeric return value is not the same as its text spelling", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: {
					testCases: [{ label: "Add", functionName: "add", args: [2, 2], expected: "4" }],
				},
				code: "function add(a, b) { return a + b; }",
			});
			await prog.execute();
			const sent = prog.sends.find((s) => s.type === "CODE_EXECUTION");
			return sent ? sent.data : null;
		});

		expect(result.score).toBe(0);
		expect(result.maxScore).toBe(1);
	});

	test("a test case whose function does not exist still shows what was expected", async () => {
		const rows = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: {
					testCases: [{ label: "Greets", functionName: "nope", args: [], expected: "hi" }],
				},
				code: "1 + 1",
			});
			await prog.execute();
			return Array.from(prog.querySelectorAll("#prog-results-list .prog-test-result")).map(
				(el) => el.textContent,
			);
		});

		expect(rows[0]).toContain("expected: hi");
		expect(rows[0]).toContain("error:");
		expect(rows[0]).toContain("not defined");
	});

	test("a test case that throws still shows what was expected", async () => {
		const rows = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: {
					testCases: [{ label: "Greets", functionName: "greet", args: [], expected: "hi" }],
				},
				code: 'function greet() { throw new Error("kaboom"); }',
			});
			await prog.execute();
			return Array.from(prog.querySelectorAll("#prog-results-list .prog-test-result")).map(
				(el) => el.textContent,
			);
		});

		expect(rows[0]).toContain("expected: hi");
		expect(rows[0]).toContain("error: kaboom");
	});

	test("a test case row shows no expected detail when the case declares none", async () => {
		const rows = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: {
					testCases: [{ label: "Runs", functionName: "nope", args: [] }],
				},
				code: "1 + 1",
			});
			await prog.execute();
			return Array.from(prog.querySelectorAll("#prog-results-list .prog-test-result")).map(
				(el) => el.textContent,
			);
		});

		expect(rows[0]).not.toContain("expected:");
		expect(rows[0]).toContain("error:");
	});

	test("a re-entrant execute() during a running run does not start a second run", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg({ attemptsLeft: 3, config: { expectedOutput: "43" } });
			const first = prog.execute();
			const second = prog.execute();
			await Promise.all([first, second]);
			const btn = prog.querySelector("#prog-btn-run");
			return { sends: prog.sends.map(s => s.type), btnText: btn.textContent, btnDisabled: btn.disabled };
		});

		expect(result.sends).toEqual(["CODE_EXECUTION"]);
		expect(result.btnDisabled).toBe(false);
		expect(result.btnText).toBe("▶ Run");
	});

	test("attempts are consumed locally so the next sequential run is blocked", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg({ attemptsLeft: 1, config: { expectedOutput: "43" } });
			await prog.execute();
			await prog.execute();
			const btn = prog.querySelector("#prog-btn-run");
			return { sends: prog.sends.map(s => s.type), btnText: btn.textContent, btnDisabled: btn.disabled };
		});

		expect(result.sends).toEqual(["CODE_EXECUTION"]);
		expect(result.btnDisabled).toBe(true);
		expect(result.btnText).toBe("No Attempts Left");
	});

	test("a run that never reached the sandbox does not consume an attempt", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg({ attemptsLeft: 2, config: { expectedOutput: "43" } });
			prog._componentConfig = undefined;
			await prog.execute();
			const sent = prog.sends.find(s => s.type === "CODE_EXECUTION");
			return sent ? { consumesAttempt: sent.data.consumesAttempt } : null;
		});

		expect(result).not.toBeNull();
		expect(result.consumesAttempt).toBe(false);
	});

	test("a Run click before the first reply never executes learner code", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg();
			prog._componentConfig = undefined;
			let sandboxCalls = 0;
			const origEval = window.sandbox.evaluate;
			window.sandbox.evaluate = (...args) => {
				sandboxCalls++;
				return origEval(...args);
			};
			try {
				await prog.execute();
			} finally {
				window.sandbox.evaluate = origEval;
			}
			const sends = prog.sends.filter((s) => s.type === "CODE_EXECUTION");
			const btn = prog.querySelector("#prog-btn-run");
			return {
				sandboxCalls,
				sendCount: sends.length,
				consumesAttempt: sends[0] ? sends[0].data.consumesAttempt : null,
				error: sends[0] ? sends[0].data.error : null,
				codeIsUndefined: sends[0] ? sends[0].data.code === undefined : null,
				attemptsLeftType: typeof prog.attemptsLeft,
				btnText: btn.textContent,
				btnDisabled: btn.disabled,
			};
		});

		expect(result.sandboxCalls).toBe(0);
		expect(result.sendCount).toBe(1);
		expect(result.consumesAttempt).toBe(false);
		expect(result.error).toBe("Component configuration not loaded");
		expect(result.codeIsUndefined).toBe(true);
		expect(result.attemptsLeftType).toBe("undefined");
		expect(result.btnDisabled).toBe(false);
		expect(result.btnText).toBe("▶ Run");
	});

	test("the first reply makes the attempts guard authoritative", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg({ id: "prog54-reply0" });
			prog._componentConfig = undefined;
			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: {
					id: "prog54-reply0",
					value: {
						starterCode: "42 + 1",
						language: "javascript",
						timeout: 5000,
						testCases: [],
						expectedOutput: "43",
						attemptsLeft: 0,
						maxScore: 1,
					},
				},
			}));
			await prog.execute();
			const btn = prog.querySelector("#prog-btn-run");
			return {
				sendCount: prog.sends.filter((s) => s.type === "CODE_EXECUTION").length,
				attemptsLeft: prog.attemptsLeft,
				btnText: btn.textContent,
				btnDisabled: btn.disabled,
			};
		});

		expect(result.sendCount).toBe(0);
		expect(result.attemptsLeft).toBe(0);
		expect(result.btnDisabled).toBe(true);
		expect(result.btnText).toBe("No Attempts Left");
	});

	test("a reply with attempts remaining resumes runs and decrements locally", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg({ id: "prog54-reply1", code: "42 + 1" });
			prog._componentConfig = undefined;
			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: {
					id: "prog54-reply1",
					value: {
						starterCode: "42 + 1",
						language: "javascript",
						timeout: 5000,
						testCases: [],
						expectedOutput: "43",
						attemptsLeft: 1,
						maxScore: 1,
					},
				},
			}));
			await prog.execute();
			await prog.execute();
			const btn = prog.querySelector("#prog-btn-run");
			return {
				sendCount: prog.sends.filter((s) => s.type === "CODE_EXECUTION").length,
				attemptsLeft: prog.attemptsLeft,
				btnText: btn.textContent,
				btnDisabled: btn.disabled,
			};
		});

		expect(result.sendCount).toBe(1);
		expect(result.attemptsLeft).toBe(0);
		expect(result.btnDisabled).toBe(true);
		expect(result.btnText).toBe("No Attempts Left");
	});

	test("a reply with no config fields does not enable runs", async () => {
		const result = await page.evaluate(async () => {
			const prog = window.__mkProg({ id: "prog54-nocfg" });
			prog._componentConfig = undefined;
			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog54-nocfg", value: { attemptsLeft: 3, maxScore: 1 } },
			}));
			let sandboxCalls = 0;
			const origEval = window.sandbox.evaluate;
			window.sandbox.evaluate = (...args) => {
				sandboxCalls++;
				return origEval(...args);
			};
			try {
				await prog.execute();
			} finally {
				window.sandbox.evaluate = origEval;
			}
			const sends = prog.sends.filter((s) => s.type === "CODE_EXECUTION");
			return {
				sandboxCalls,
				sendCount: sends.length,
				consumesAttempt: sends[0] ? sends[0].data.consumesAttempt : null,
				error: sends[0] ? sends[0].data.error : null,
				configBuilt: prog._componentConfig !== undefined,
				attemptsLeft: prog.attemptsLeft,
			};
		});

		expect(result.configBuilt).toBe(false);
		expect(result.sandboxCalls).toBe(0);
		expect(result.sendCount).toBe(1);
		expect(result.consumesAttempt).toBe(false);
		expect(result.error).toBe("Component configuration not loaded");
		expect(result.attemptsLeft).toBe(3);
	});

	test("exhausted label with no score reported is the plain No Attempts Left", async () => {
		const btn = await page.evaluate(() => {
			const prog = window.__mkProg({ id: "prog-noscore" });

			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog-noscore", value: { attemptsLeft: 0, maxScore: 4 } },
			}));

			const run = prog.querySelector("#prog-btn-run");
			return { disabled: run.disabled, text: run.textContent };
		});

		expect(btn.disabled).toBe(true);
		expect(btn.text).toBe("No Attempts Left");
	});

	test("exhausted label with maxScore 0 is the plain No Attempts Left", async () => {
		const btn = await page.evaluate(() => {
			const prog = window.__mkProg({ id: "prog-zero-max" });

			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog-zero-max", value: { attemptsLeft: 0, score: 3, maxScore: 0 } },
			}));

			const run = prog.querySelector("#prog-btn-run");
			return { disabled: run.disabled, text: run.textContent };
		});

		expect(btn.disabled).toBe(true);
		expect(btn.text).toBe("No Attempts Left");
	});

	test("execute() does not run code when attempts are exhausted", async () => {
		const sends = await page.evaluate(async () => {
			const prog = window.__mkProg({
				attemptsLeft: 0,
				config: { expectedOutput: "43" },
			});
			await prog.execute();
			return prog.sends.map(s => s.type);
		});

		expect(sends).toEqual([]);
	});

	test("blocked run disables the Run button and labels it No Attempts Left", async () => {
		const btn = await page.evaluate(async () => {
			const prog = window.__mkProg({
				id: "prog-exhausted",
				config: { expectedOutput: "43" },
			});

			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: {
					id: "prog-exhausted",
					value: { attemptsLeft: 0, score: 1, maxScore: 2 },
				},
			}));

			await prog.execute();
			const run = prog.querySelector("#prog-btn-run");
			return { disabled: run.disabled, text: run.textContent };
		});

		expect(btn.disabled).toBe(true);
		expect(btn.text).toBe("No Attempts Left");
	});

	test("zero attempts left reported by state immediately disables the Run button", async () => {
		const btn = await page.evaluate(() => {
			const prog = window.__mkProg({ id: "prog-final" });

			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog-final", value: { attemptsLeft: 1, score: 0, maxScore: 1 } },
			}));

			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog-final", value: { attemptsLeft: 0, score: 1, maxScore: 1 } },
			}));

			const run = prog.querySelector("#prog-btn-run");
			return { disabled: run.disabled, text: run.textContent };
		});

		expect(btn.disabled).toBe(true);
		expect(btn.text).toBe("No Attempts Left");
	});

	test("Ctrl-Enter runs code when attempts remain", async () => {
		const sends = await page.evaluate(async () => {
			let resolveSend;
			const sent = new Promise((resolve) => { resolveSend = resolve; });
			const prog = window.__mkProg({
				attemptsLeft: 3,
				onSend: (type) => {
					if (type === "CODE_EXECUTION") resolveSend();
				},
			});
			prog.editor.getInputField().dispatchEvent(new KeyboardEvent("keydown", {
				key: "Enter", code: "Enter", keyCode: 13, which: 13,
				ctrlKey: true, bubbles: true, cancelable: true,
			}));
			await Promise.race([sent, new Promise((resolve) => setTimeout(resolve, 1000))]);
			return prog.sends.map(s => s.type);
		});

		expect(sends).toEqual(["CODE_EXECUTION"]);
	});

	test("Ctrl-Enter is blocked when attempts are exhausted", async () => {
		const sends = await page.evaluate(async () => {
			const prog = window.__mkProg({ attemptsLeft: 0 });
			prog.editor.getInputField().dispatchEvent(new KeyboardEvent("keydown", {
				key: "Enter", code: "Enter", keyCode: 13, which: 13,
				ctrlKey: true, bubbles: true, cancelable: true,
			}));
			await new Promise((resolve) => setTimeout(resolve, 300));
			return prog.sends.map(s => s.type);
		});

		expect(sends).toEqual([]);
	});

	test("execute() still runs while attempts remain, including unlimited pages", async () => {
		const results = await page.evaluate(async () => {
			const outcomes = [];
			for (const attemptsLeft of [3, Infinity]) {
				const prog = window.__mkProg({ attemptsLeft });
				await prog.execute();
				const sent = prog.sends.find(s => s.type === "CODE_EXECUTION");
				outcomes.push(sent ? sent.data.returnValue : null);
			}
			return outcomes;
		});

		expect(results).toEqual([43, 43]);
	});

	test("failed result rows escape HTML coming from student output", async () => {
		const html = await page.evaluate(async () => {
			const prog = window.__mkProg({
				config: { expectedOutput: "safe" },
				code: 'console.log("<img src=x onerror=alert(1)>")',
			});
			await prog.execute();
			return Array.from(prog.querySelectorAll("#prog-results-list .prog-test-result")).map(
				(el) => el.innerHTML,
			);
		});

		expect(html[0]).toContain("&lt;img src=x onerror=alert(1)&gt;");
		expect(html[0]).not.toContain("<img src=");
	});

	// --- object and array test cases -------------------------------------
	// `expected` reaches the sandbox by postMessage, so it arrives as a
	// structured clone and can never be === the learner's return value. These
	// pin that the parent deep-compares plain containers instead, and that it
	// fails closed rather than hanging when a return value is pathological.

	const gradeObjects = async (config, code) =>
		page.evaluate(async ([cfg, src]) => {
			const prog = window.__mkProg({ config: cfg, code: src });
			await prog.execute();
			const sent = prog.sends.find((s) => s.type === "CODE_EXECUTION");
			return sent ? sent.data : null;
		}, [config, code]);

	const renderObjects = async (config, code) =>
		page.evaluate(async ([cfg, src]) => {
			const prog = window.__mkProg({ config: cfg, code: src });
			await prog.execute();
			return Array.from(prog.querySelectorAll("#prog-results-list .prog-test-result")).map(
				(el) => el.textContent,
			);
		}, [config, code]);

	test("a test case returning a matching object passes", async () => {
		const result = await gradeObjects(
			{ testCases: [{ label: "Obj", functionName: "make", args: [], expected: { a: 2 } }] },
			"function make() { return { a: 2 }; }",
		);

		expect(result.score).toBe(1);
		expect(result.maxScore).toBe(1);
		expect(result.completed).toBe(true);
	});

	test("a test case returning a matching array passes", async () => {
		const result = await gradeObjects(
			{ testCases: [{ label: "Arr", functionName: "make", args: [], expected: [1, 2, 3] }] },
			"function make() { return [1, 2, 3]; }",
		);

		expect(result.score).toBe(1);
		expect(result.maxScore).toBe(1);
	});

	test("key order does not decide an object test case", async () => {
		const result = await gradeObjects(
			{ testCases: [{ label: "Obj", functionName: "make", args: [], expected: { a: 1, b: 2 } }] },
			"function make() { return { b: 2, a: 1 }; }",
		);

		expect(result.score).toBe(1);
	});

	test("an object test case with a wrong nested value fails", async () => {
		const result = await gradeObjects(
			{ testCases: [{ label: "Obj", functionName: "make", args: [], expected: { a: { b: 2 } } }] },
			"function make() { return { a: { b: 1 } }; }",
		);

		expect(result.score).toBe(0);
		expect(result.maxScore).toBe(1);
		expect(result.completed).toBe(false);
	});

	test("an array test case of the wrong length fails", async () => {
		const result = await gradeObjects(
			{ testCases: [{ label: "Arr", functionName: "make", args: [], expected: [1, 2, 3] }] },
			"function make() { return [1, 2]; }",
		);

		expect(result.score).toBe(0);
	});

	test("an object test case with an extra key fails", async () => {
		const result = await gradeObjects(
			{ testCases: [{ label: "Obj", functionName: "make", args: [], expected: { a: 1 } }] },
			"function make() { return { a: 1, b: 2 }; }",
		);

		expect(result.score).toBe(0);
	});

	test("a self-referential return value fails instead of hanging", async () => {
		const result = await gradeObjects(
			{ testCases: [{ label: "Cyc", functionName: "make", args: [], expected: { a: 1 } }] },
			"function make() { var o = { a: 1 }; o.self = o; return o; }",
		);

		expect(result.score).toBe(0);
		expect(result.maxScore).toBe(1);
	});

	test("a wide return value with an unexpected key set fails without hanging", async () => {
		const result = await gradeObjects(
			{ testCases: [{ label: "Wide", functionName: "make", args: [], expected: { a: 1 } }] },
			"function make() { var o = {}; for (var i = 0; i < 60000; i++) { o['k' + i] = i; } o.a = 1; return o; }",
		);

		expect(result.score).toBe(0);
		expect(result.maxScore).toBe(1);
	});

	test("a very wide return value is truncated in the detail row", async () => {
		const rows = await renderObjects(
			{ testCases: [{ label: "Wide", functionName: "make", args: [], expected: { a: 1 } }] },
			"function make() { var o = {}; for (var i = 0; i < 60000; i++) { o['k' + i] = i; } o.a = 999; return o; }",
		);

		expect(rows[0]).toContain("truncated");
		expect(rows[0].length).toBeLessThan(4000);
	});

	test("a non-plain object return value keeps the sandbox verdict and fails", async () => {
		const result = await gradeObjects(
			{ testCases: [{ label: "Date", functionName: "make", args: [], expected: { a: 1 } }] },
			"function make() { return new Date(0); }",
		);

		expect(result.score).toBe(0);
		expect(result.maxScore).toBe(1);
	});

	test("an errored object test case still scores zero", async () => {
		const result = await gradeObjects(
			{ testCases: [{ label: "Obj", functionName: "nope", args: [], expected: { a: 2 } }] },
			"1 + 1",
		);

		expect(result.score).toBe(0);
		expect(result.maxScore).toBe(1);
		expect(result.completed).toBe(false);
	});

	test("a failing object row shows JSON, not [object Object]", async () => {
		const rows = await renderObjects(
			{ testCases: [{ label: "Obj", functionName: "make", args: [], expected: { a: 2 } }] },
			"function make() { return { a: 1 }; }",
		);

		expect(rows[0]).toContain('expected: {"a":2}');
		expect(rows[0]).toContain('got: {"a":1}');
		expect(rows[0]).not.toContain("[object Object]");
	});

	test("a self-referential return value renders without throwing", async () => {
		const rows = await renderObjects(
			{ testCases: [{ label: "Cyc", functionName: "make", args: [], expected: { a: 1 } }] },
			"function make() { var o = { a: 9 }; o.self = o; return o; }",
		);

		expect(rows[0]).toContain("Cyc");
		expect(rows[0]).toContain('"self":"[circular]"');
		expect(rows[0]).not.toContain("[object Object]");
	});

	test("a value referenced twice renders in full instead of being called circular", async () => {
		const rows = await renderObjects(
			{ testCases: [{ label: "Shared", functionName: "make", args: [], expected: { a: 1 } }] },
			"function make() { var s = { z: 9 }; return { a: s, q: s }; }",
		);

		expect(rows[0]).not.toContain("[circular]");
		expect(rows[0]).toContain('got: {"a":{"z":9},"q":{"z":9}}');
	});

	test("a deeply nested matching object, including an array of objects, passes", async () => {
		const result = await gradeObjects(
			{
				testCases: [
					{
						label: "Deep",
						functionName: "make",
						args: [],
						expected: { a: { b: { c: 1, z: 0 } }, d: [{ e: 2 }, 3] },
					},
				],
			},
			"function make() { return { d: [{ e: 2 }, 3], a: { b: { z: 0, c: 1 } } }; }",
		);

		expect(result.score).toBe(1);
		expect(result.maxScore).toBe(1);
		expect(result.completed).toBe(true);
	});

	test("an array of objects keeps its element order", async () => {
		const result = await gradeObjects(
			{ testCases: [{ label: "Arr", functionName: "make", args: [], expected: [{ a: 1 }, { b: 2 }] }] },
			"function make() { return [{ b: 2 }, { a: 1 }]; }",
		);

		expect(result.score).toBe(0);
		expect(result.maxScore).toBe(1);
		expect(result.completed).toBe(false);
	});

	test("a class instance return value passes against its plain-object expected", async () => {
		const result = await gradeObjects(
			{ testCases: [{ label: "Cls", functionName: "make", args: [], expected: { a: 1 } }] },
			"function make() { function P() { this.a = 1; } return new P(); }",
		);

		expect(result.score).toBe(1);
		expect(result.maxScore).toBe(1);
		expect(result.completed).toBe(true);
	});

	test("a long string return value is truncated in the detail row", async () => {
		const rows = await renderObjects(
			{ testCases: [{ label: "Long", functionName: "make", args: [], expected: "short" }] },
			"function make() { return new Array(6001).join('x'); }",
		);

		expect(rows[0]).toContain("truncated");
		expect(rows[0].length).toBeLessThan(4000);
	});

	test("a very long error message is truncated in the detail row", async () => {
		const rows = await renderObjects(
			{ testCases: [{ label: "Err", functionName: "make", args: [] }] },
			"function make() { throw new Error(new Array(6001).join('x')); }",
		);

		expect(rows[0]).toContain("error:");
		expect(rows[0]).toContain("truncated");
		expect(rows[0].length).toBeLessThan(4000);
	});
});
