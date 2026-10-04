const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("CourseProgramming toolbar score and attempts readouts", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
		await page.addScriptTag({ path: "../src/vendor/codemirror/lib/codemirror.js" });
		await page.addScriptTag({ path: "../src/vendor/codemirror/mode/javascript/javascript.js" });
		await page.addScriptTag({ path: "../src/internal/sandbox.js" });
		await page.addScriptTag({ path: "../src/internal/components.js" });
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("a state reply reporting attempts remaining shows it in the toolbar", async () => {
		const text = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog-attempts-readout");
			prog.connectedCallback();

			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog-attempts-readout", value: { attemptsLeft: 2 } },
			}));

			return prog.querySelector(".prog-attempts").textContent;
		});

		expect(text).toBe("Attempts left: 2");
	});

	test("a state reply reporting a score shows it as a percent in the toolbar", async () => {
		const text = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog-score-readout");
			prog.connectedCallback();

			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog-score-readout", value: { attemptsLeft: 3, score: 1, maxScore: 2 } },
			}));

			return prog.querySelector(".prog-score").textContent;
		});

		expect(text).toBe("Best score: 50%");
	});

	test("score and attempts shown after a run both update on the next run", async () => {
		const readouts = await page.evaluate(async () => {
			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog-toolbar-runs");
			prog.connectedCallback();
			prog._componentConfig = { timeout: 5000, expectedOutput: "43" };
			prog.attemptsLeft = 3;
			prog.editor.setValue("42 + 1");

			const reply = (value) => window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog-toolbar-runs", value },
			}));
			const read = () => ({
				score: prog.querySelector(".prog-score").textContent,
				attempts: prog.querySelector(".prog-attempts").textContent,
			});

			const beforeAnyRun = read();

			await prog.execute();
			reply({ attemptsLeft: 2, score: 1, maxScore: 2 });
			const afterFirstRun = read();

			await prog.execute();
			reply({ attemptsLeft: 1, score: 2, maxScore: 2 });
			const afterSecondRun = read();

			return { beforeAnyRun, afterFirstRun, afterSecondRun };
		});

		expect(readouts.beforeAnyRun).toEqual({ score: "Best score: —", attempts: "Attempts left: —" });
		expect(readouts.afterFirstRun).toEqual({ score: "Best score: 50%", attempts: "Attempts left: 2" });
		expect(readouts.afterSecondRun).toEqual({ score: "Best score: 100%", attempts: "Attempts left: 1" });
	});

	test("a later worse run still reads the latched best score", async () => {
		const texts = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog-best");
			prog.connectedCallback();

			const reply = (value) => window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog-best", value },
			}));

			reply({ attemptsLeft: 3, score: 2, maxScore: 2 });
			const afterPass = prog.querySelector(".prog-score").textContent;

			// state latches the best score while the results panel below shows the
			// latest run's rows, so the label has to say "best" to stay truthful
			reply({
				attemptsLeft: 2,
				score: 2,
				maxScore: 2,
				testResults: [{ label: "Output matches expected", passed: false }],
			});
			const afterWorseRun = prog.querySelector(".prog-score").textContent;

			return { afterPass, afterWorseRun };
		});

		expect(texts.afterPass).toBe("Best score: 100%");
		expect(texts.afterWorseRun).toBe("Best score: 100%");
	});

	test("a page with no attempt limit reads Unlimited rather than Infinity", async () => {
		const text = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog-unlimited");
			prog.connectedCallback();

			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog-unlimited", value: { attemptsLeft: Infinity, score: 1, maxScore: 2 } },
			}));

			return prog.querySelector(".prog-attempts").textContent;
		});

		expect(text).toBe("Attempts left: Unlimited");
	});

	test("a reply that reports no usable score keeps the placeholder instead of NaN", async () => {
		const texts = await page.evaluate(() => {
			const read = (id, value) => {
				const prog = document.createElement("course-programming");
				prog.setAttribute("id", id);
				prog.connectedCallback();
				window.dispatchEvent(new CustomEvent("programming-data", { detail: { id, value } }));
				return {
					score: prog.querySelector(".prog-score").textContent,
					attempts: prog.querySelector(".prog-attempts").textContent,
				};
			};
			return {
				attemptsOnlyReply: read("prog-no-score", { attemptsLeft: 3 }),
				runWithoutCriteria: read("prog-zero-max", { attemptsLeft: 2, score: 0, maxScore: 0 }),
			};
		});

		expect(texts.attemptsOnlyReply).toEqual({ score: "Best score: —", attempts: "Attempts left: 3" });
		expect(texts.runWithoutCriteria).toEqual({ score: "Best score: —", attempts: "Attempts left: 2" });
	});

	test("a reply that reports no attempts keeps the attempts placeholder", async () => {
		const text = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog-no-attempts");
			prog.connectedCallback();

			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: {
					id: "prog-no-attempts",
					value: { testResults: [{ label: "Output matches expected", passed: true }] },
				},
			}));

			return prog.querySelector(".prog-attempts").textContent;
		});

		expect(text).toBe("Attempts left: —");
	});

	test("two components on one page keep independent readouts without duplicate ids", async () => {
		const result = await page.evaluate(() => {
			for (const id of ["prog-pair-a", "prog-pair-b"]) {
				const prog = document.createElement("course-programming");
				prog.setAttribute("id", id);
				document.body.appendChild(prog);
			}

			const reply = (id, value) => window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id, value },
			}));
			reply("prog-pair-a", { attemptsLeft: 3, score: 1, maxScore: 4 });
			reply("prog-pair-b", { attemptsLeft: 1, score: 3, maxScore: 4 });

			const read = (id) => {
				const el = document.querySelector(`course-programming#${id}`);
				return {
					score: el.querySelector(".prog-score").textContent,
					attempts: el.querySelector(".prog-attempts").textContent,
				};
			};

			return {
				readoutIds: Array.from(
					document.querySelectorAll("[id='prog-score'], [id='prog-attempts']"),
				).map((el) => el.id),
				a: read("prog-pair-a"),
				b: read("prog-pair-b"),
			};
		});

		expect(result.readoutIds).toEqual([]);
		expect(result.a).toEqual({ score: "Best score: 25%", attempts: "Attempts left: 3" });
		expect(result.b).toEqual({ score: "Best score: 75%", attempts: "Attempts left: 1" });
	});

	test("the attempts readout reflects a run even if the parent never replies", async () => {
		const texts = await page.evaluate(async () => {
			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog-local-attempts");
			prog.connectedCallback();
			prog._componentConfig = { timeout: 5000, expectedOutput: "43" };
			prog.editor.setValue("42 + 1");

			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog-local-attempts", value: { attemptsLeft: 3, score: 0, maxScore: 1 } },
			}));
			const before = prog.querySelector(".prog-attempts").textContent;

			// the parent's reply is what normally refreshes the toolbar; a consumed
			// attempt must not leave the readout claiming it is still available
			await prog.execute();
			const after = prog.querySelector(".prog-attempts").textContent;

			return { before, after };
		});

		expect(texts.before).toBe("Attempts left: 3");
		expect(texts.after).toBe("Attempts left: 2");
	});

	test("an exhausted attempts count keeps the best score in the toolbar, not on the button", async () => {
		const result = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog-exhausted-readout");
			prog.connectedCallback();

			window.dispatchEvent(new CustomEvent("programming-data", {
				detail: { id: "prog-exhausted-readout", value: { attemptsLeft: 0, score: 1, maxScore: 2 } },
			}));

			const run = prog.querySelector("#prog-btn-run");
			return {
				button: run.textContent,
				disabled: run.disabled,
				readout: prog.querySelector(".prog-score").textContent,
			};
		});

		expect(result.disabled).toBe(true);
		expect(result.button).toBe("No Attempts Left");
		expect(result.readout).toBe("Best score: 50%");
	});

	test("both readouts are polite live regions so assistive tech hears them change", async () => {
		const attrs = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			prog.setAttribute("id", "prog-live-region");
			prog.connectedCallback();

			return Array.from(prog.querySelectorAll(".prog-score, .prog-attempts")).map((el) => ({
				className: el.className,
				role: el.getAttribute("role"),
				ariaLive: el.getAttribute("aria-live"),
			}));
		});

		expect(attrs).toHaveLength(2);
		for (const attr of attrs) {
			expect(attr.role).toBe("status");
			expect(attr.ariaLive).toBe("polite");
		}
	});
});

test.describe("prog readout styles shipped in lesson_styles.css", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await page.goto("about:blank");
		await page.addStyleTag({ path: "../src/lessons/lesson_styles.css" });
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("score and attempts readouts render as muted tabular text", async () => {
		const result = await page.evaluate(() => {
			const muted = (() => {
				const probe = document.createElement("span");
				probe.style.color = getComputedStyle(document.documentElement)
					.getPropertyValue("--text-muted");
				document.body.appendChild(probe);
				const rgb = getComputedStyle(probe).color;
				probe.remove();
				return rgb;
			})();

			const read = (className) => {
				const el = document.createElement("span");
				el.className = className;
				el.textContent = "0%";
				document.body.appendChild(el);
				const cs = getComputedStyle(el);
				return { color: cs.color, fontVariantNumeric: cs.fontVariantNumeric };
			};

			return {
				muted,
				score: read("prog-score"),
				attempts: read("prog-attempts"),
			};
		});

		expect(result.score.color).toBe(result.muted);
		expect(result.score.fontVariantNumeric).toBe("tabular-nums");
		expect(result.attempts.color).toBe(result.muted);
		expect(result.attempts.fontVariantNumeric).toBe("tabular-nums");
	});
});

test.describe("prog toolbar fits narrow LMS iframes", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
	});

	test.afterEach(async () => {
		await page.close();
	});

	// SCORM packages render inside a narrow LMS iframe: measured on the shipped
	// lesson page itself, the toolbar must not push Run/Reset off-screen, or the
	// learner cannot submit at all.
	for (const width of [480, 375, 320]) {
		test(`the shipped lesson page at ${width}px causes no overflow and leaves Run and Reset reachable`, async () => {
			await page.setViewportSize({ width, height: 800 });
			await page.goto("http://localhost:8080/lessons/programming_example.html");
			await page.waitForFunction(
				() => document.querySelectorAll(".prog-btn-run").length === 2,
			);

			// Drive the widest payload the component can render; measuring the
			// pre-reply placeholders (Best score: — / Attempts left: —) would let
			// the layout fit even on the broken stylesheet.
			await page.evaluate(() => {
				for (const id of ["prog_hello", "prog_double"]) {
					window.dispatchEvent(new CustomEvent("programming-data", {
						detail: { id, value: { attemptsLeft: Infinity, score: 1, maxScore: 1 } },
					}));
				}
			});

			const measured = await page.evaluate(() => ({
				// the readouts are sampled in the same turn as the layout, so a
				// reply that changes them cannot race past this guard
				readouts: Array.from(
					document.querySelectorAll("course-programming"),
				).map((el) => ({
					score: el.querySelector(".prog-score").textContent,
					attempts: el.querySelector(".prog-attempts").textContent,
				})),
				overflow:
					document.documentElement.scrollWidth - document.documentElement.clientWidth,
				controls: Array.from(
					document.querySelectorAll(".prog-btn-run, .prog-btn-reset"),
				).map((el) => {
					const rect = el.getBoundingClientRect();
					return { left: rect.left, right: rect.right };
				}),
			}));

			expect(measured.readouts).toHaveLength(2);
			for (const readout of measured.readouts) {
				expect(readout.score).toBe("Best score: 100%");
				expect(readout.attempts).toBe("Attempts left: Unlimited");
			}
			expect(measured.overflow).toBe(0);
			expect(measured.controls).toHaveLength(4);
			for (const rect of measured.controls) {
				expect(rect.left).toBeGreaterThanOrEqual(0);
				expect(rect.right).toBeLessThanOrEqual(width);
			}
		});
	}
});
