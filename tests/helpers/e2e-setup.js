const { setupPage } = require("./page-setup.js");

async function setupE2EPage(page) {
	await page.addInitScript(() => localStorage.clear());
	return setupPage(page);
}

module.exports = { setupE2EPage };
