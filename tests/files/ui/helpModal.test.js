const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("helpModal", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("toggleHelp should open modal when overlay is hidden", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui._onRefresh = () => {};
			ui._onReset = () => {};
			ui.helpOverlay.style.display = "none";
			document.getElementById("lesson-frame").style.display = "block";
			ui.isPaused = false;

			ui.toggleHelp();

			return {
				overlayDisplay: ui.helpOverlay.style.display,
				frameDisplay: document.getElementById("lesson-frame").style.display,
				isPaused: ui.isPaused,
				hasButtons: ui.helpContent.innerHTML.includes("Help with Current Page") &&
					ui.helpContent.innerHTML.includes("General Course Help") &&
					ui.helpContent.innerHTML.includes("Refresh This Web Page") &&
					ui.helpContent.innerHTML.includes("Reset Course Progress"),
			};
		});

		expect(result.overlayDisplay).toBe("flex");
		expect(result.frameDisplay).toBe("none");
		expect(result.isPaused).toBe(true);
		expect(result.hasButtons).toBe(true);
	});

	test("toggleHelp should close modal when overlay is already open", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.helpOverlay.style.display = "flex";
			document.getElementById("lesson-frame").style.display = "none";
			ui.isPaused = true;

			ui.toggleHelp();

			return {
				overlayDisplay: ui.helpOverlay.style.display,
				frameDisplay: document.getElementById("lesson-frame").style.display,
				isPaused: ui.isPaused,
			};
		});

		expect(result.overlayDisplay).toBe("none");
		expect(result.frameDisplay).toBe("block");
		expect(result.isPaused).toBe(false);
	});

	test("showHelpMenu should render all 4 buttons and use global callbacks", async () => {
		const result = await page.evaluate(() => {
			try {
				if(!ui.infoBanner) ui.init();
				ui._onRefresh = () => "refreshed";
				ui._onReset = () => "reset";

				ui.showHelpMenu();

				const html = ui.helpContent.innerHTML;
				return {
					ok: true,
					onRefreshType: typeof ui._onRefresh,
					onResetType: typeof ui._onReset,
					hasPageHelp: html.includes("Help with Current Page"),
					hasGeneralHelp: html.includes("General Course Help"),
					hasRefresh: html.includes("Refresh This Web Page"),
					hasReset: html.includes("Reset Course Progress"),
					onRefreshCall: ui._onRefresh ? ui._onRefresh() : null,
					onResetCall: ui._onReset ? ui._onReset() : null,
				};
			} catch(e) {
				return { ok: false, error: e.message, stack: e.stack };
			}
		});

		expect(result.ok).toBe(true);
		expect(result.onRefreshType).toBe("function");
		expect(result.onResetType).toBe("function");
		expect(result.hasPageHelp).toBe(true);
		expect(result.hasGeneralHelp).toBe(true);
		expect(result.hasRefresh).toBe(true);
		expect(result.hasReset).toBe(true);
		expect(result.onRefreshCall).toBe("refreshed");
		expect(result.onResetCall).toBe("reset");
	});

	test("showPageHelp should render completion table with checkmarks", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const page = {
				completionRules: {
					watchTime: 30,
					score: 0.7,
					scrolled: true,
					videoProgress: 0.8,
				},
				maxScore: 100,
				components: [],
			};
			const pageDelta = {
				watchTime: 45,
				score: 85,
				scrolled: true,
				videoProgress: 0.9,
				components: {},
			};

			ui.showPageHelp(page, pageDelta);

			const html = ui.helpContent.innerHTML;
			return {
				hasTitle: html.includes("Page Completion Requirements"),
				hasTimeRow: html.includes("Time on Page"),
				hasScoreRow: html.includes("Minimum Score"),
				hasScrolledRow: html.includes("Read Entire Article"),
				hasVideoRow: html.includes("Watch Video"),
				hasRefreshBtn: html.includes("Refresh Status"),
				hasBackBtn: html.includes("Back to Menu"),
				hasPassIcons: html.includes("status-pass"),
			};
		});

		expect(result.hasTitle).toBe(true);
		expect(result.hasTimeRow).toBe(true);
		expect(result.hasScoreRow).toBe(true);
		expect(result.hasScrolledRow).toBe(true);
		expect(result.hasVideoRow).toBe(true);
		expect(result.hasRefreshBtn).toBe(true);
		expect(result.hasBackBtn).toBe(true);
		expect(result.hasPassIcons).toBe(true);
	});

	test("showPageHelp should show fail icons for unmet requirements", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const page = {
				completionRules: {
					watchTime: 60,
					score: 0.7,
					scrolled: true,
					videoProgress: 0.8,
				},
				maxScore: 100,
				components: [],
			};
			const pageDelta = {
				watchTime: 10,
				score: 30,
				scrolled: false,
				videoProgress: 0.2,
				components: {},
			};

			ui.showPageHelp(page, pageDelta);

			const html = ui.helpContent.innerHTML;
			return {
				hasFailIcons: html.includes("status-fail"),
				timeDisplayed: html.includes("10 seconds"),
				scoreDisplayed: html.includes("30%"),
			};
		});

		expect(result.hasFailIcons).toBe(true);
		expect(result.timeDisplayed).toBe(true);
		expect(result.scoreDisplayed).toBe(true);
	});

	test("showPageHelp shows Pending and a fail icon for an incomplete programming component", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const page = {
				completionRules: {
					watchTime: 0,
					score: 0,
					scrolled: false,
					videoProgress: 0,
					requireSubmission: true,
				},
				maxScore: 0,
				components: [{ id: "prog1", type: "programming" }],
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
				components: { prog1: { type: "programming", completed: false } },
			};

			ui.showPageHelp(page, pageDelta);

			const html = ui.helpContent.innerHTML;
			const row = html.split("<tr>").find(r => r.includes("Submit all")) || "";
			return { rowFound: row.length > 0, row, text: ui.helpContent.textContent };
		});

		expect(result.rowFound).toBe(true);
		expect(result.text).toContain("Complete Code Assignments");
		expect(result.row).toContain("Pending");
		expect(result.row).toContain("status-fail");
	});

	test("showPageHelp shows Submitted and a pass icon for a completed programming component", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const page = {
				completionRules: {
					watchTime: 0,
					score: 0,
					scrolled: false,
					videoProgress: 0,
					requireSubmission: true,
				},
				maxScore: 0,
				components: [{ id: "prog1", type: "programming" }],
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
				components: { prog1: { type: "programming", completed: true } },
			};

			ui.showPageHelp(page, pageDelta);

			const html = ui.helpContent.innerHTML;
			const row = html.split("<tr>").find(r => r.includes("Submit all")) || "";
			return { rowFound: row.length > 0, row, text: ui.helpContent.textContent };
		});

		expect(result.rowFound).toBe(true);
		expect(result.text).toContain("Complete Code Assignments");
		expect(result.row).toContain("Submitted");
		expect(result.row).toContain("status-pass");
	});

	test("showPageHelp keeps the Submit Quizzes label for quiz-only pages", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const page = {
				completionRules: {
					watchTime: 0,
					score: 0,
					scrolled: false,
					videoProgress: 0,
					requireSubmission: true,
				},
				maxScore: 0,
				components: [{ id: "quiz1", type: "quiz" }],
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
				components: { quiz1: { type: "quiz", completed: true } },
			};

			ui.showPageHelp(page, pageDelta);

			const html = ui.helpContent.innerHTML;
			const row = html.split("<tr>").find(r => r.includes("Submit all")) || "";
			return { row, text: ui.helpContent.textContent };
		});

		expect(result.row).toContain("<td>Submit Quizzes</td>");
		expect(result.row).toContain("Submitted");
		expect(result.row).toContain("status-pass");
		expect(result.text).not.toContain("Complete Code Assignments");
	});

	test("showPageHelp mixes labels on a page with both a quiz and a programming component", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const page = {
				completionRules: {
					watchTime: 0,
					score: 0,
					scrolled: false,
					videoProgress: 0,
					requireSubmission: true,
				},
				maxScore: 0,
				components: [
					{ id: "quiz1", type: "quiz" },
					{ id: "prog1", type: "programming" },
				],
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
				components: {
					quiz1: { type: "quiz", completed: true },
					prog1: { type: "programming", completed: false },
				},
			};

			ui.showPageHelp(page, pageDelta);

			const html = ui.helpContent.innerHTML;
			const row = html.split("<tr>").find(r => r.includes("Submit all")) || "";
			return { rowFound: row.length > 0, row, text: ui.helpContent.textContent };
		});

		expect(result.rowFound).toBe(true);
		expect(result.text).toContain("Submit Quizzes & Assignments");
		expect(result.row).toContain("Pending");
		expect(result.row).toContain("status-fail");
	});

	test("showGeneralHelp should render help iframe", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.showGeneralHelp();
			const html = ui.helpContent.innerHTML;
			return {
				hasIframe: html.includes("help.html"),
				hasBackBtn: html.includes("Back to Menu"),
			};
		});

		expect(result.hasIframe).toBe(true);
		expect(result.hasBackBtn).toBe(true);
	});

	test("closeHelp should restore modal state", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const frame = document.getElementById("lesson-frame");
			ui.helpOverlay.style.display = "flex";
			frame.style.display = "none";
			ui.isPaused = true;
			ui.helpContent.innerHTML = "<p>Some content</p>";

			ui.closeHelp(frame);

			return {
				overlayDisplay: ui.helpOverlay.style.display,
				contentEmpty: ui.helpContent.innerHTML === "",
				frameDisplay: frame.style.display,
				isPaused: ui.isPaused,
			};
		});

		expect(result.overlayDisplay).toBe("none");
		expect(result.contentEmpty).toBe(true);
		expect(result.frameDisplay).toBe("block");
		expect(result.isPaused).toBe(false);
	});

	test("closeHelpFrame should query lesson-frame and call closeHelp", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const frame = document.getElementById("lesson-frame");
			ui.helpOverlay.style.display = "flex";
			frame.style.display = "none";
			ui.isPaused = true;
			ui.helpContent.innerHTML = "<p>test</p>";

			ui.closeHelpFrame();

			return {
				overlayDisplay: ui.helpOverlay.style.display,
				contentEmpty: ui.helpContent.innerHTML === "",
				frameDisplay: frame.style.display,
				isPaused: ui.isPaused,
			};
		});

		expect(result.overlayDisplay).toBe("none");
		expect(result.contentEmpty).toBe(true);
		expect(result.frameDisplay).toBe("block");
		expect(result.isPaused).toBe(false);
	});

	test("closeHelp should restore lastActiveElement focus", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const btn = document.createElement("button");
			btn.id = "mock-focus-target";
			document.body.appendChild(btn);
			btn.focus();

			ui.lastActiveElement = btn;
			const frame = document.getElementById("lesson-frame");

			ui.closeHelp(frame);

			const focused = document.activeElement;
			document.body.removeChild(btn);

			return {
				focusRestored: focused === btn,
				lastCleared: ui.lastActiveElement === null,
			};
		});

		expect(result.focusRestored).toBe(true);
		expect(result.lastCleared).toBe(true);
	});

	test("showPageHelp should re-render when called without args (Refresh button)", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const page = {
				completionRules: { watchTime: 10, score: 0.5, scrolled: false, videoProgress: 0 },
				maxScore: 100,
				components: [],
			};
			const pageDelta = {
				watchTime: 20,
				score: 80,
				components: {},
				videoProgress: 0,
			};

			ui.showPageHelp(page, pageDelta);
			const firstRender = ui.helpContent.innerHTML.includes("20 seconds");

			// Simulate Refresh button call (no args)
			ui.showPageHelp();
			const secondRender = ui.helpContent.innerHTML.includes("20 seconds");

			return {
				firstRender,
				secondRender,
			};
		});

		expect(result.firstRender).toBe(true);
		expect(result.secondRender).toBe(true);
	});

	test("showPageHelp and completion.checkIfComplete agree on every requireSubmission fixture", async () => {
		const result = await page.evaluate(() => {
			if (!ui.infoBanner) ui.init();
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const makeRules = () => ({
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
				requireSubmission: true,
			});
			const makeDelta = (components) => ({
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
				...(components === undefined ? {} : {components}),
			});

			// Every requireSubmission shape that can leave the gate without
			// per-component state to read. Each must render an honest failing
			// row AND report the same verdict, so the learner is never told
			// "Submitted" while state.next() still blocks the page.
			const fixtures = [
				{
					name: "noKey",
					// The page omits the `components` key entirely.
					page: {completionRules: makeRules(), maxScore: 0},
					delta: makeDelta({}),
					expectLabel: "Submission Required",
					forbidLabel: "Submit Quizzes",
				},
				{
					name: "articleOnly",
					// The page declares a component, but none is a submission.
					page: {
						completionRules: makeRules(),
						maxScore: 0,
						components: [{id: "art1", type: "article"}],
					},
					delta: makeDelta({}),
					expectLabel: "Submission Required",
					forbidLabel: "Submit Quizzes",
				},
				{
					name: "declaredQuizNoDeltaState",
					// The page does declare a submission, but the delta carries
					// no component state for it at all (no `components` key).
					page: {
						completionRules: makeRules(),
						maxScore: 0,
						components: [{id: "quiz1", type: "quiz"}],
					},
					delta: makeDelta(undefined),
					expectLabel: "Submit Quizzes",
					forbidLabel: "Complete Code Assignments",
				},
			];

			const summarize = (row, fixture) => ({
				found: row.length > 0,
				label: row.includes(fixture.expectLabel),
				forbidden: row.includes(fixture.forbidLabel),
				pending: row.includes("Pending"),
				submitted: row.includes("Submitted"),
				failIcon: row.includes("status-fail"),
				passIcon: row.includes("status-pass"),
			});

			const verdicts = {};
			const rows = {};
			for (const fixture of fixtures) {
				let verdict = null;
				let threw = null;
				try {
					verdict = completion.checkIfComplete(fixture.page, fixture.delta);
				} catch (e) {
					threw = e.message;
				}
				ui.showPageHelp(fixture.page, fixture.delta);
				const html = ui.helpContent.innerHTML;
				const row = html.split("<tr>").find(r => r.includes("Submit all")) || "";
				rows[fixture.name] = summarize(row, fixture);
				verdicts[fixture.name] = {verdict, threw};
			}

			return {
				error: undefined,
				rows,
				verdicts,
				// ui and completion must agree on the verdict for every fixture.
				agreement: Object.keys(verdicts).every(k => verdicts[k].threw === null && verdicts[k].verdict === false),
			};
		});

		expect(result.error).toBeUndefined();
		expect(Object.keys(result.rows)).toEqual(["noKey", "articleOnly", "declaredQuizNoDeltaState"]);
		for (const fixture of Object.values(result.rows)) {
			expect(fixture.found).toBe(true);
			expect(fixture.label).toBe(true);
			expect(fixture.forbidden).toBe(false);
			expect(fixture.pending).toBe(true);
			expect(fixture.submitted).toBe(false);
			expect(fixture.failIcon).toBe(true);
			expect(fixture.passIcon).toBe(false);
		}
		expect(result.agreement).toBe(true);
	});
});
