async function setupE2EPage(page) {
	await page.addInitScript(() => localStorage.clear());
	await page.goto("http://localhost:8080/");
	await page.waitForFunction(() =>
		typeof state !== "undefined" && state.initialized,
	);
	return page;
}

module.exports = { setupE2EPage };
