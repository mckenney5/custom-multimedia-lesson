const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

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
				attemptsLeftType: typeof prog.attemptsLeft,
				btnText: btn.textContent,
				btnDisabled: btn.disabled,
			};
		});

		expect(result.sandboxCalls).toBe(0);
		expect(result.sendCount).toBe(1);
		expect(result.consumesAttempt).toBe(false);
		expect(result.error).toBe("Component configuration not loaded");
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

	test("exhausted label omits the score when no score has been reported", async () => {
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

	test("exhausted label omits the score when maxScore is 0", async () => {
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

	test("blocked run disables the Run button and labels it with the final score", async () => {
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
		expect(btn.text).toBe("No Attempts Left - Score 50");
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
		expect(btn.text).toBe("No Attempts Left - Score 100");
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
});
