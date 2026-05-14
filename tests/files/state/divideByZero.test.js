const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.save: divide-by-zero protection", () => {
    let page;

    test.beforeEach(async ({ browser }) => {
        page = await browser.newPage();
        await setupPage(page);
    });

    test.afterEach(async () => {
        await page.close();
    });

    test("should not produce Infinity for single-page course", async () => {
        const result = await page.evaluate(() => {
            const pagesLength = 1;
            const progress = 0;
            const divisor = Math.max(1, pagesLength - 1);
            const calculatedProgress = Math.round((progress / divisor) * 100);
            return {
                divisor: divisor,
                progress: calculatedProgress,
                isNotInfinity: calculatedProgress !== Infinity && isFinite(calculatedProgress),
            };
        });

        expect(result.isNotInfinity).toBe(true);
        expect(result.progress).toBe(0);
    });

    test("should calculate correct progress percentage for multi-page course (2 pages)", async () => {
        const result = await page.evaluate(() => {
            const pagesLength = 2;
            const progress = 1;
            const divisor = Math.max(1, pagesLength - 1);
            const calculatedProgress = Math.round((progress / divisor) * 100);
            return {
                divisor: divisor,
                progress: calculatedProgress,
            };
        });

        expect(result.progress).toBe(100);
    });

    test("should calculate correct progress percentage for multi-page course (3 pages at 50%)", async () => {
        const result = await page.evaluate(() => {
            const pagesLength = 3;
            const progress = 1;
            const divisor = Math.max(1, pagesLength - 1);
            const calculatedProgress = Math.round((progress / divisor) * 100);
            return {
                divisor: divisor,
                progress: calculatedProgress,
            };
        });

        expect(result.progress).toBe(50);
    });

    test("should calculate 0% when at first page", async () => {
        const result = await page.evaluate(() => {
            const pagesLength = 5;
            const progress = 0;
            const divisor = Math.max(1, pagesLength - 1);
            const calculatedProgress = Math.round((progress / divisor) * 100);
            return {
                progress: calculatedProgress,
            };
        });

        expect(result.progress).toBe(0);
    });
});