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
});
