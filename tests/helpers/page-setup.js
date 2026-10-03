// state.init() failures die inside the async window.onload handler, so a page
// can look fully loaded while state never becomes initialized. Arm a crash
// recorder before navigating and keep the browser's console.errors so a failed
// boot reports its real cause instead of a bare wait timeout.
const INIT_TIMEOUT_MS = 15000;
const INIT_GRACE_MS = 2000;

function recordStartupCrashes(page) {
	return page.addInitScript(() => {
		const record = (text) => {
			if (!window.__stateInitError) window.__stateInitError = text;
		};
		window.addEventListener("error", (event) => {
			record(String((event.error && event.error.stack) || event.message));
		});
		window.addEventListener("unhandledrejection", (event) => {
			record(String((event.reason && event.reason.stack) || event.reason));
		});
	});
}

function formatConsoleErrors(consoleErrors) {
	if (consoleErrors.length === 0) return "";
	return `\nbrowser console.error:\n- ${consoleErrors.join("\n- ")}`;
}

function waitForInitialized(page, timeout) {
	return page
		.waitForFunction(
			() => typeof state !== "undefined" && state.initialized,
			null,
			{ timeout },
		)
		.then(() => true)
		.catch(() => false);
}

/**
 * Sets up a Playwright page for testing.
 * Navigates to the test server and waits for state.init() to finish, so that
 * state.handleMessage() and the rest of the public state API are usable the
 * moment this resolves. If the page never initializes, throws with the crash
 * and the browser console.errors that caused it.
 * @param {import('@playwright/test').Page} page - Playwright page instance
 * @returns {Promise<import('@playwright/test').Page>}
 */
async function setupPage(page) {
	const consoleErrors = [];
	const onConsole = (message) => {
		if (message.type() === "error") consoleErrors.push(message.text());
	};
	page.on("console", onConsole);

	try {
		await recordStartupCrashes(page);
		await page.goto("http://localhost:8080");

		try {
			await page.waitForFunction(
				() =>
					(typeof state !== "undefined" && state.initialized) ||
					Boolean(window.__stateInitError),
				null,
				{ timeout: INIT_TIMEOUT_MS },
			);
		} catch (error) {
			throw new Error(
				`setupPage: state was not initialized after ${INIT_TIMEOUT_MS}ms (${error.message})` +
					formatConsoleErrors(consoleErrors),
			);
		}

		const boot = await page.evaluate(() => ({
			initialized: typeof state !== "undefined" && state.initialized,
			initError: window.__stateInitError || null,
		}));
		if (boot.initialized) return page;

		// A non-fatal page rejection can arm the marker while init is still
		// running; give it a moment before reporting a failed boot.
		if (await waitForInitialized(page, INIT_GRACE_MS)) return page;

		throw new Error(
			`setupPage: state.init() failed:\n${boot.initError || "no crash recorded"}` +
				formatConsoleErrors(consoleErrors),
		);
	} finally {
		page.off("console", onConsole);
	}
}

module.exports = { setupPage };
