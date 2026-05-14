const utils = {
	escapeHTML: function(str) {
		if (typeof str !== "string") return "";
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	},

	validateUrl: function(url) {
		if (typeof url !== "string") return null;
		const trimmed = url.trim();
		if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
		if (trimmed.startsWith("//")) return null;
		return null;
	},

	generatePasscode: function() {
		if (typeof crypto !== "undefined" && crypto.randomUUID) {
			return crypto.randomUUID();
		}

		const length = 32;
		const cryptoObj = window.crypto || window.msCrypto;
		if (cryptoObj) {
			const items = new Uint8Array(length);
			cryptoObj.getRandomValues(items);
			return items.join("");
		}

		const result = [];
		for (let i = 0; i < length; i++) {
			result.push(Math.random() * (Math.random() * 1000).toFixed(0));
		}
		return result.join("");
	},
};