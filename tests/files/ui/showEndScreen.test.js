const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("showEndScreen", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should show pass screen with cert button when hasPassed=true and cert enabled", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.isPaused = false;
			ui.helpOverlay.style.display = "none";
			ui.helpContent.innerHTML = "";

			ui.showEndScreen(true, "85", "70", {
				onQuit: () => {},
				onPrint: () => {},
				printData: {
					certConfig: { enabled: true },
				},
			});

			return {
				isPaused: ui.isPaused,
				lessonHidden: document.getElementById("lesson-frame").style.display === "none",
				overlayShown: ui.helpOverlay.style.display === "flex",
				hasCertButton: ui.helpContent.innerHTML.includes("Print Certificate"),
				hasReviewButton: ui.helpContent.innerHTML.includes("Review Course Materials"),
				hasExitButton: ui.helpContent.innerHTML.includes("Exit Course"),
				hasPassTitle: ui.helpContent.innerHTML.includes("Course Completed"),
			};
		});

		expect(result.isPaused).toBe(true);
		expect(result.lessonHidden).toBe(true);
		expect(result.overlayShown).toBe(true);
		expect(result.hasCertButton).toBe(true);
		expect(result.hasReviewButton).toBe(true);
		expect(result.hasExitButton).toBe(true);
		expect(result.hasPassTitle).toBe(true);
	});

	test("should show pass screen without cert button when hasPassed=true but cert disabled", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.helpOverlay.style.display = "none";
			ui.helpContent.innerHTML = "";

			ui.showEndScreen(true, "85", "70", {
				onQuit: () => {},
				onPrint: () => {},
				printData: {
					certConfig: { enabled: false },
				},
			});

			return {
				hasCertButton: ui.helpContent.innerHTML.includes("Print Certificate"),
				hasPassMessage: ui.helpContent.innerHTML.includes("successfully finished"),
			};
		});

		expect(result.hasCertButton).toBe(false);
		expect(result.hasPassMessage).toBe(true);
	});

	test("should show fail screen without cert button when hasPassed=false", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.helpOverlay.style.display = "none";
			ui.helpContent.innerHTML = "";

			ui.showEndScreen(false, "50", "70", {
				onQuit: () => {},
				onPrint: () => {},
				printData: {
					certConfig: { enabled: true },
				},
			});

			return {
				hasCertButton: ui.helpContent.innerHTML.includes("Print Certificate"),
				hasFailTitle: ui.helpContent.innerHTML.includes("Course Incomplete"),
				hasRequiredScore: ui.helpContent.innerHTML.includes("70%"),
			};
		});

		expect(result.hasCertButton).toBe(false);
		expect(result.hasFailTitle).toBe(true);
		expect(result.hasRequiredScore).toBe(true);
	});

	test("should disable prev/next buttons", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			document.getElementById("prev").disabled = false;
			document.getElementById("next").disabled = false;

			ui.showEndScreen(true, "85", "70", {
				onQuit: () => {},
				onPrint: () => {},
				printData: { certConfig: {} },
			});

			return {
				prevDisabled: document.getElementById("prev").disabled,
				nextDisabled: document.getElementById("next").disabled,
			};
		});

		expect(result.prevDisabled).toBe(true);
		expect(result.nextDisabled).toBe(true);
	});

	test("should include score in pass message", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.helpOverlay.style.display = "none";
			ui.helpContent.innerHTML = "";

			ui.showEndScreen(true, "92", "70", {
				onQuit: () => {},
				onPrint: () => {},
				printData: { certConfig: {} },
			});

			return {
				hasScore: ui.helpContent.innerHTML.includes("<strong>92%</strong>"),
			};
		});

		expect(result.hasScore).toBe(true);
	});

	test("should include both scores in fail message", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.helpOverlay.style.display = "none";
			ui.helpContent.innerHTML = "";

			ui.showEndScreen(false, "55", "70", {
				onQuit: () => {},
				onPrint: () => {},
				printData: { certConfig: {} },
			});

			return {
				hasActualScore: ui.helpContent.innerHTML.includes("<strong>55%</strong>"),
				hasRequiredScore: ui.helpContent.innerHTML.includes("<strong>70%</strong>"),
			};
		});

		expect(result.hasActualScore).toBe(true);
		expect(result.hasRequiredScore).toBe(true);
	});

	test("should save lastActiveElement", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const mockButton = document.createElement("button");
			mockButton.id = "mock-focus-end";
			document.body.appendChild(mockButton);
			mockButton.focus();

			ui.showEndScreen(true, "85", "70", {
				onQuit: () => {},
				onPrint: () => {},
				printData: { certConfig: {} },
			});

			const savedElement = ui.lastActiveElement;
			document.body.removeChild(mockButton);

			return {
				lastActiveElementSaved: savedElement === mockButton,
			};
		});

		expect(result.lastActiveElementSaved).toBe(true);
	});

	test("should set isPaused to true", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.isPaused = false;
			ui.helpOverlay.style.display = "none";
			ui.helpContent.innerHTML = "";

			ui.showEndScreen(true, "85", "70", {
				onQuit: () => {},
				onPrint: () => {},
				printData: { certConfig: {} },
			});

			return { isPaused: ui.isPaused };
		});

		expect(result.isPaused).toBe(true);
	});

	test("should escape XSS payloads in score strings", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.helpOverlay.style.display = "none";
			ui.helpContent.innerHTML = "";

			ui.showEndScreen(true, '<img src=x onerror="alert(1)">', "70", {
				onQuit: () => {},
				onPrint: () => {},
				printData: { certConfig: {} },
			});

			const html = ui.helpContent.innerHTML;
			return {
				noRawImgTag: !html.includes('<img src=x onerror'),
				hasEscaped: html.includes("&lt;img"),
			};
		});

		expect(result.noRawImgTag).toBe(true);
		expect(result.hasEscaped).toBe(true);
	});

	test("should handle null helpContent gracefully", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const savedContent = ui.helpContent;
			ui.helpContent = null;
			try {
				ui.showEndScreen(true, "85", "70", {
					onQuit: () => {},
				onPrint: () => {},
					printData: { certConfig: {} },
				});
				return { threwError: false };
			} catch (e) {
				return { threwError: true, message: e.message };
			} finally {
				ui.helpContent = savedContent;
			}
		});

		expect(result.threwError).toBe(false);
	});

	test("should escape score strings with attribute-breaking payloads", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.helpOverlay.style.display = "none";
			ui.helpContent.innerHTML = "";

			ui.showEndScreen(true, '55"><img src=x onerror="alert(1)">', "70", {
				onQuit: () => {},
				onPrint: () => {},
				printData: { certConfig: {} },
			});

			const html = ui.helpContent.innerHTML;
			return {
				noRawImgTag: !html.includes("<img"),
				textVisible: ui.helpContent.innerText.includes('55"><img'),
			};
		});

		expect(result.noRawImgTag).toBe(true);
		expect(result.textVisible).toBe(true);
	});

	test("should escape required score strings with HTML injection payloads", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.helpOverlay.style.display = "none";
			ui.helpContent.innerHTML = "";

			ui.showEndScreen(false, "55", "<script>alert(1)</script>", {
				onQuit: () => {},
				onPrint: () => {},
				printData: { certConfig: {} },
			});

			const html = ui.helpContent.innerHTML;
			return {
				hasRawScript: html.includes("<script>alert(1)</script>"),
				hasEscapedScript: html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"),
			};
		});

		expect(result.hasRawScript).toBe(false);
		expect(result.hasEscapedScript).toBe(true);
	});

	test("should store printData in _printData", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const testData = { studentName: "Alice", certConfig: { enabled: true } };

			ui.showEndScreen(true, "85", "70", {
				onQuit: () => {},
				onPrint: () => {},
				printData: testData,
			});

			return {
				printStored: ui._printData === testData,
			};
		});

		expect(result.printStored).toBe(true);
	});

	test("should store onPrint callback and call it on invocation", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			let called = false;
			const onPrint = () => { called = true; };

			ui.showEndScreen(true, "85", "70", {
				onQuit: () => {},
				onPrint,
				printData: { certConfig: { enabled: true } },
			});

			const onPrintType = typeof ui._onPrint;
			if(ui._onPrint) ui._onPrint();
			return {
				onPrintType,
				printCalled: called,
			};
		});

		expect(result.onPrintType).toBe("function");
		expect(result.printCalled).toBe(true);
	});

	test("should store onQuit callback, call it on invocation, and avoid state.quit coupling", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			let quitCalled = false;
			const onQuit = () => { quitCalled = true; };

			ui.showEndScreen(true, "85", "70", {
				onQuit,
				onPrint: () => {},
				printData: { certConfig: { enabled: true } },
			});

			const onQuitType = typeof ui._onQuit;
			const templateHtml = ui.helpContent.innerHTML;
			const hasStateQuitInTemplate = templateHtml.includes("state.quit()");
			const hasUiOnQuitInTemplate = templateHtml.includes("ui._onQuit()");

			if(ui._onQuit) ui._onQuit();

			return {
				onQuitType,
				quitCalled,
				hasStateQuitInTemplate,
				hasUiOnQuitInTemplate,
			};
		});

		expect(result.onQuitType).toBe("function");
		expect(result.quitCalled).toBe(true);
		expect(result.hasStateQuitInTemplate).toBe(false);
		expect(result.hasUiOnQuitInTemplate).toBe(true);
	});
});
