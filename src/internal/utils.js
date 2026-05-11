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
};