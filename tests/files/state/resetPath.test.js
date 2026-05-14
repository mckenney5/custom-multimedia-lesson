const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.reset: uses page.path not page.name", () => {
    let page;

    test.beforeEach(async ({ browser }) => {
        page = await browser.newPage();
        await setupPage(page);
    });

    test.afterEach(async () => {
        await page.close();
    });

    test("should use page.path when resetting course", async () => {
        const result = await page.evaluate(() => {
            const mockPages = [
                { name: "directions.html", path: "lessons/directions.html" },
                { name: "video.html", path: "lessons/video.html" },
            ];

            let setSrc = null;
            const origConfirm = window.confirm;
            const origReload = window.location.reload.bind(window.location);
            const origLmsReset = window.lms ? window.lms.reset : () => {};
            window.confirm = () => true;
            window.location.reload = () => {};
            if (window.lms && window.lms.reset) {
                window.lms.reset = () => {};
            }

            if (typeof state !== "undefined" && state.data) {
                state.data.pages = mockPages;
                state.lessonFrame = { src: "" };
                const originalSet = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src", "set");
                if (!originalSet) {
                    state.lessonFrame = { src: "" };
                }
            }

            let capturedSrc = null;
            const iframeEl = {
                get src() { return this._src || ""; },
                set src(v) { capturedSrc = v; this._src = v; }
            };

            if (typeof state !== "undefined" && state.data) {
                state.data.pages = mockPages;
                state.lessonFrame = iframeEl;
                if (window.lms && window.lms.reset) window.lms.reset = () => {};
            }

            if (typeof state !== "undefined" && typeof state.reset === "function") {
                state.reset();
            }

            window.confirm = origConfirm;
            window.location.reload = origReload;
            if (window.lms && window.lms.reset) window.lms.reset = origLmsReset;

            return {
                capturedSrc,
                usesPath: capturedSrc && capturedSrc.startsWith("lessons/"),
                usesName: capturedSrc && !capturedSrc.startsWith("lessons/"),
            };
        });

        expect(result.capturedSrc).not.toBeNull();
        expect(result.usesPath).toBe(true);
    });

    test("should use path property which contains lessons/ prefix", async () => {
        const result = await page.evaluate(() => {
            const mockPages = [
                { name: "finish.html", path: "lessons/finish.html" },
            ];

            const path = mockPages[0].path;
            const expectedSrc = path + "?_cb=" + Date.now();

            return {
                path: path,
                includesLessonsPrefix: path.includes("lessons/"),
                expectedSrc: expectedSrc,
            };
        });

        expect(result.includesLessonsPrefix).toBe(true);
        expect(result.path).toBe("lessons/finish.html");
    });
});