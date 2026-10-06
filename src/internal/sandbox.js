(function () {
	"use strict";

	const DEFAULTS = { timeout: 5000, testCases: [] };

	// Learner code runs untrusted and unattended, so a `for (;;) console.log(...)`
	// loop can push millions of lines inside one timeout window. The cap is
	// applied where the lines are pushed, inside the sandbox document: bounding
	// after the postMessage would still let the iframe build and clone the whole
	// array, which is the memory cost we are trying to avoid. Both the line and
	// the character budget matter — a loop bounds the line count, while a single
	// console.log of a large string bounds itself.
	const MAX_STDOUT_LINES = 500;
	const MAX_STDOUT_CHARS = 10000;
	const STDOUT_SENTINEL = "[output truncated]";

	const SRCDOC = [
		"<!DOCTYPE html>",
		"<html><body><script>",
		"var stdout = [];",
		"var __stdoutChars = 0;",
		"var __stdoutTruncated = false;",
		"console.log = function() {",
		// Once the sentinel is in, nothing further is captured: the budget is
		// spent, and pushing again would make the payload unbounded again.
		"if (__stdoutTruncated) return;",
		"var line = Array.from(arguments).map(String).join(' ');",
		"if (stdout.length >= " + MAX_STDOUT_LINES + " || __stdoutChars + line.length > " + MAX_STDOUT_CHARS + ") {",
		// Keep the part of the line that still fits the budget, so a huge single
		// line shows its head rather than being replaced entirely by the marker.
		"var room = " + MAX_STDOUT_CHARS + " - __stdoutChars;",
		"if (room > 0 && line.length > room) {",
		"stdout.push(line.slice(0, room));",
		"__stdoutChars += room;",
		"}",
		"__stdoutTruncated = true;",
		"stdout.push(" + JSON.stringify(STDOUT_SENTINEL) + ");",
		"return;",
		"}",
		"stdout.push(line);",
		"__stdoutChars += line.length;",
		"};",
		"function runTestCases(fnName, args, expected) {",
		"try {",
		"var fn = (0, eval)(fnName);",
		"if (typeof fn !== 'function') {",
		"return { passed: false, error: \"Function '\" + fnName + \"' is not defined\" };",
		"}",
		"var result = fn.apply(null, args);",
		"return {",
		"passed: result === expected,",
		"actual: result,",
		"expected: expected,",
		"};",
		"} catch(err) {",
		"return { passed: false, error: err.message };",
		"}",
		"}",
		"window.addEventListener('message', function(e) {",
		"try {",
		"var msg = e.data;",
		"var __code__ = typeof msg === 'string' ? msg : msg.code;",
		"var __testCases__ = (typeof msg === 'object' && msg.testCases) ? msg.testCases : [];",
		"var __result__ = (0, eval)(__code__);",
		"var __testResults__ = [];",
		"for (var i = 0; i < __testCases__.length; i++) {",
		"var tc = __testCases__[i];",
		"var tcResult = runTestCases(tc.functionName, tc.args || [], tc.expected);",
		"__testResults__.push({",
		"label: tc.label || ('Test case ' + (i + 1)),",
		"passed: tcResult.passed,",
		"actual: tcResult.actual,",
		"expected: tcResult.expected,",
		"error: tcResult.error || null,",
		"});",
		"}",
		"parent.postMessage({",
		"stdout: stdout,",
		"returnValue: __result__,",
		"error: null,",
		"testResults: __testResults__.length > 0 ? __testResults__ : undefined,",
		"}, '*');",
		"} catch(err) {",
		"parent.postMessage({",
		"stdout: stdout,",
		"returnValue: undefined,",
		"error: err.message,",
		"testResults: undefined,",
		"}, '*');",
		"}",
		"});",
		"parent.postMessage({ type: 'SANDBOX_READY' }, '*');",
		"<\/script><\/body><\/html>",
	].join("\n");

	function evaluate(code, opts) {
		const config = Object.assign({}, DEFAULTS, opts || {});
		const timeout = config.timeout;
		const testCases = config.testCases;

		return new Promise(function (resolve) {
			const timer = setTimeout(function () {
				cleanup();
				resolve({ stdout: [], returnValue: undefined, error: "Execution timed out" });
			}, timeout);

			const iframe = document.createElement("iframe");
			iframe.style.display = "none";
			iframe.setAttribute("sandbox", "allow-scripts");

			const handler = function (e) {
				if (e.source !== iframe.contentWindow) return;
				if (e.data && e.data.type === "SANDBOX_READY") return;
				cleanup();
				clearTimeout(timer);
				resolve(e.data);
			};

			const cleanup = function () {
				window.removeEventListener("message", handler);
				window.removeEventListener("message", readyHandler);
				if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
			};

			window.addEventListener("message", handler);

			iframe.srcdoc = SRCDOC;

			document.body.appendChild(iframe);

			const readyHandler = function (e) {
				if (e.source !== iframe.contentWindow) return;
				if (e.data.type === "SANDBOX_READY") {
					window.removeEventListener("message", readyHandler);
					if (testCases.length > 0) {
						iframe.contentWindow.postMessage({ code: code, testCases: testCases }, "*");
					} else {
						iframe.contentWindow.postMessage(code, "*");
					}
				}
			};
			window.addEventListener("message", readyHandler);
		});
	}

	window.sandbox = { evaluate: evaluate };
})();
