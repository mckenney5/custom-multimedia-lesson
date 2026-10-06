const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseProgramming._handleProgrammingData', () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
		await page.addScriptTag({ path: '../src/vendor/codemirror/lib/codemirror.js' });
		await page.addScriptTag({ path: '../src/vendor/codemirror/mode/javascript/javascript.js' });
		await page.addScriptTag({ path: '../src/internal/components.js' });
	});

	test.afterEach(async () => {
		await page.close();
	});

	test('first call saves full config including static fields', async () => {
		const result = await page.evaluate(() => {
			const prog = document.createElement('course-programming');
			prog.setAttribute('id', 'prog1');
			prog.connectedCallback();

			window.dispatchEvent(new CustomEvent('programming-data', {
				detail: {
					id: 'prog1',
					value: {
						starterCode: 'function greet() { return "Hello"; }',
						language: 'javascript',
						timeout: 5000,
						expectedOutput: 'Hello',
						testCases: [{ label: 'Test 1', input: '4', expected: '16' }],
						options: ['show-wrong'],
						attemptsLeft: 3,
						hasAttempted: false,
					},
				},
			}));

			return {
				starterCode: prog._componentConfig.starterCode,
				language: prog._componentConfig.language,
				timeout: prog._componentConfig.timeout,
				expectedOutput: prog._componentConfig.expectedOutput,
				testCases: prog._componentConfig.testCases,
				options: prog._componentConfig.options,
				attemptsLeft: prog.attemptsLeft,
				hasAttempted: prog.hasAttempted,
			};
		});

		expect(result.starterCode).toBe('function greet() { return "Hello"; }');
		expect(result.language).toBe('javascript');
		expect(result.timeout).toBe(5000);
		expect(result.expectedOutput).toBe('Hello');
		expect(result.testCases).toEqual([{ label: 'Test 1', input: '4', expected: '16' }]);
		expect(result.options).toEqual(['show-wrong']);
		expect(result.attemptsLeft).toBe(3);
		expect(result.hasAttempted).toBe(false);
	});

	test('subsequent call preserves static config fields', async () => {
		const result = await page.evaluate(() => {
			const prog = document.createElement('course-programming');
			prog.setAttribute('id', 'prog1');
			prog.connectedCallback();

			window.dispatchEvent(new CustomEvent('programming-data', {
				detail: {
					id: 'prog1',
					value: {
						starterCode: 'function greet() { return "Hello"; }',
						language: 'javascript',
						timeout: 5000,
						expectedOutput: 'Hello',
						testCases: [{ label: 'Test 1', input: '4', expected: '16' }],
						options: ['show-wrong'],
						attemptsLeft: 3,
						hasAttempted: false,
					},
				},
			}));

			window.dispatchEvent(new CustomEvent('programming-data', {
				detail: {
					id: 'prog1',
					value: {
						attemptsLeft: 2,
						hasAttempted: true,
						testResults: [{ label: 'Test 1', passed: true }],
					},
				},
			}));

			return {
				starterCode: prog._componentConfig.starterCode,
				expectedOutput: prog._componentConfig.expectedOutput,
				timeout: prog._componentConfig.timeout,
				testCases: prog._componentConfig.testCases,
				options: prog._componentConfig.options,
				attemptsLeft: prog.attemptsLeft,
				hasAttempted: prog.hasAttempted,
			};
		});

		expect(result.starterCode).toBe('function greet() { return "Hello"; }');
		expect(result.expectedOutput).toBe('Hello');
		expect(result.timeout).toBe(5000);
		expect(result.testCases).toEqual([{ label: 'Test 1', input: '4', expected: '16' }]);
		expect(result.options).toEqual(['show-wrong']);
		expect(result.attemptsLeft).toBe(2);
		expect(result.hasAttempted).toBe(true);
	});

	test('_resetCode uses original starterCode after subsequent update', async () => {
		const result = await page.evaluate(() => {
			const prog = document.createElement('course-programming');
			prog.setAttribute('id', 'prog1');
			prog.connectedCallback();

			window.dispatchEvent(new CustomEvent('programming-data', {
				detail: {
					id: 'prog1',
					value: {
						starterCode: 'function greet() { return "Hello"; }',
						expectedOutput: 'Hello',
						attemptsLeft: 3,
						hasAttempted: false,
					},
				},
			}));

			window.dispatchEvent(new CustomEvent('programming-data', {
				detail: {
					id: 'prog1',
					value: {
						attemptsLeft: 2,
						hasAttempted: true,
					},
				},
			}));

			prog._resetCode();
			return prog.editor.getValue();
		});

		expect(result).toBe('function greet() { return "Hello"; }');
	});

	test('stored failed results render expected and got on refresh', async () => {
		const rows = await page.evaluate(() => {
			const prog = document.createElement('course-programming');
			prog.setAttribute('id', 'prog-rerender');
			prog.connectedCallback();

			window.dispatchEvent(new CustomEvent('programming-data', {
				detail: {
					id: 'prog-rerender',
					value: {
						testResults: [
							{ label: 'Output matches expected', passed: false, expected: 'Hello world', actual: 'Goodbye', error: null },
							{ label: 'Greets', passed: true, expected: 'hi', actual: 'hi', error: null },
						],
					},
				},
			}));

			return Array.from(prog.querySelectorAll('#prog-results-list .prog-test-result'))
				.map((el) => el.textContent);
		});

		expect(rows).toHaveLength(2);
		expect(rows[0]).toContain('expected: Hello world');
		expect(rows[0]).toContain('got: Goodbye');
		expect(rows[1]).not.toContain('expected:');
	});

	test("a reply for a run that did not reach the sandbox does not re-show the results panel", async () => {
		const state = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog-stale");
			prog.connectedCallback();

			const rows = [
				{ label: "Output matches expected", passed: true, expected: "43", actual: "43", error: null },
			];
			const resultsDiv = prog.querySelector("#prog-results");
			const resultsList = prog.querySelector("#prog-results-list");

			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog-stale", value: { testResults: rows, attemptsLeft: 3, hasAttempted: true } },
			}));
			const afterFirstRun = {
				display: resultsDiv.style.display,
				rows: resultsList.querySelectorAll(".prog-test-result").length,
			};

			// execute() hides the panel before reporting the failed attempt
			resultsDiv.style.display = "none";
			resultsList.innerHTML = "";

			// the reply for that run arrives: nothing ran, so nothing is repainted
			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: {
					id: "prog-stale",
					value: { testResults: rows, attemptsLeft: 3, hasAttempted: true, consumesAttempt: false },
				},
			}));
			const afterNonConsumingReply = {
				display: resultsDiv.style.display,
				rows: resultsList.querySelectorAll(".prog-test-result").length,
			};

			// a state reply with no consumesAttempt (GET_PROGRAMMING_DATA, page load)
			// carries authoritative persisted results and does render them
			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog-stale", value: { testResults: rows, attemptsLeft: 3, hasAttempted: true } },
			}));
			const afterStateReply = {
				display: resultsDiv.style.display,
				rows: resultsList.querySelectorAll(".prog-test-result").length,
			};

			return { afterFirstRun, afterNonConsumingReply, afterStateReply };
		});

		expect(state.afterFirstRun.display).toBe("block");
		expect(state.afterFirstRun.rows).toBe(1);
		expect(state.afterNonConsumingReply.display).toBe("none");
		expect(state.afterNonConsumingReply.rows).toBe(0);
		expect(state.afterStateReply.display).toBe("block");
		expect(state.afterStateReply.rows).toBe(1);
	});

	test("_resetCode clears sessionStorage draft", async () => {
		const result = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog1");
			prog.connectedCallback();

			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: {
					id: "prog1",
					value: {
						starterCode: 'function greet() { return "Hello"; }',
						pageName: "programming_example.html",
						attemptsLeft: 3,
					},
				},
			}));

			// Simulate a draft being stored in sessionStorage
			window.sessionStorage.setItem("cml:draft:programming_example.html:prog1", "OLD CODE");

			prog._resetCode();

			return {
				editorValue: prog.editor.getValue(),
				draftCleared: window.sessionStorage.getItem("cml:draft:programming_example.html:prog1") === null,
			};
		});

		expect(result.editorValue).toBe('function greet() { return "Hello"; }');
		expect(result.draftCleared).toBe(true);
	});

	test("_resetCode clears sessionStorage draft even when called before config arrives", async () => {
		const result = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog2");
			prog.connectedCallback();

			// Simulate a draft being stored in sessionStorage BEFORE config arrives
			window.sessionStorage.setItem("cml:draft:programming_example.html:prog2", "OLD CODE");

			// Call reset BEFORE config arrives
			prog._resetCode();

			// Now simulate config arriving
			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: {
					id: "prog2",
					value: {
						starterCode: 'function greet() { return "Hello"; }',
						pageName: "programming_example.html",
						attemptsLeft: 3,
					},
				},
			}));

			return {
				editorValue: prog.editor.getValue(),
				draftCleared: window.sessionStorage.getItem("cml:draft:programming_example.html:prog2") === null,
			};
		});

		expect(result.editorValue).toBe('function greet() { return "Hello"; }');
		expect(result.draftCleared).toBe(true);
	});
});
