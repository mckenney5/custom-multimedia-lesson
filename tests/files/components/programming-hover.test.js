const { test, expect } = require('@playwright/test');

test.describe('prog-btn-run hover visibility', () => {
	async function setupLessonPage(page) {
		await page.goto('about:blank');
		await page.addStyleTag({ path: '../src/lessons/lesson_styles.css' });
	}

	test('light theme: hover should show visible background', async ({ page }) => {
		await setupLessonPage(page);

		await page.evaluate(() => {
			const btn = document.createElement('button');
			btn.className = 'prog-btn-run';
			btn.textContent = '▶ Run';
			btn.id = 'test-btn';
			document.body.appendChild(btn);
		});

		const btn = page.locator('#test-btn');
		await btn.hover();
		const bgColor = await btn.evaluate(el => getComputedStyle(el).backgroundColor);
		expect(bgColor).not.toBe('transparent');
		expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
	});

	test('dark theme: hover should show visible background', async ({ page }) => {
		await setupLessonPage(page);

		await page.evaluate(() => {
			document.documentElement.setAttribute('data-theme', 'dark');
			const btn = document.createElement('button');
			btn.className = 'prog-btn-run';
			btn.textContent = '▶ Run';
			btn.id = 'test-btn';
			document.body.appendChild(btn);
		});

		const btn = page.locator('#test-btn');
		await btn.hover();
		const bgColor = await btn.evaluate(el => getComputedStyle(el).backgroundColor);
		expect(bgColor).not.toBe('transparent');
		expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
	});
});
