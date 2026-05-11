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
			const mockState = {
				isPaused: false,
				lessonFrame: { style: { display: "block" } },
				helpOverlay: { style: { display: "none" } },
				helpContent: { innerHTML: "" },
				lastActiveElement: null,
				data: {
					courseRules: {
						certificate: { enabled: true },
					},
				},
			};

			certificate.init(mockState);
			certificate.showEndScreen(true, "85", "70");

			return {
				isPaused: mockState.isPaused,
				lessonHidden: mockState.lessonFrame.style.display === "none",
				overlayShown: mockState.helpOverlay.style.display === "flex",
				hasCertButton: mockState.helpContent.innerHTML.includes("Print Certificate"),
				hasReviewButton: mockState.helpContent.innerHTML.includes("Review Course Materials"),
				hasExitButton: mockState.helpContent.innerHTML.includes("Exit Course"),
				hasPassTitle: mockState.helpContent.innerHTML.includes("Course Completed"),
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
			const mockState = {
				isPaused: false,
				lessonFrame: { style: { display: "block" } },
				helpOverlay: { style: { display: "none" } },
				helpContent: { innerHTML: "" },
				data: {
					courseRules: {
						certificate: { enabled: false },
					},
				},
			};

			certificate.init(mockState);
			certificate.showEndScreen(true, "85", "70");

			return {
				hasCertButton: mockState.helpContent.innerHTML.includes("Print Certificate"),
				hasPassMessage: mockState.helpContent.innerHTML.includes("successfully finished"),
			};
		});

		expect(result.hasCertButton).toBe(false);
		expect(result.hasPassMessage).toBe(true);
	});

	test("should show fail screen without cert button when hasPassed=false", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				isPaused: false,
				lessonFrame: { style: { display: "block" } },
				helpOverlay: { style: { display: "none" } },
				helpContent: { innerHTML: "" },
				data: {
					courseRules: {
						certificate: { enabled: true },
					},
				},
			};

			certificate.init(mockState);
			certificate.showEndScreen(false, "50", "70");

			return {
				hasCertButton: mockState.helpContent.innerHTML.includes("Print Certificate"),
				hasFailTitle: mockState.helpContent.innerHTML.includes("Course Incomplete"),
				hasRequiredScore: mockState.helpContent.innerHTML.includes("70%"),
			};
		});

		expect(result.hasCertButton).toBe(false);
		expect(result.hasFailTitle).toBe(true);
		expect(result.hasRequiredScore).toBe(true);
	});

	test("should disable prev/next buttons", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				isPaused: false,
				lessonFrame: { style: { display: "block" } },
				helpOverlay: { style: { display: "none" } },
				helpContent: { innerHTML: "" },
				lastActiveElement: null,
				data: { courseRules: {} },
			};

			document.getElementById("prev").disabled = false;
			document.getElementById("next").disabled = false;

			certificate.init(mockState);
			certificate.showEndScreen(true, "85", "70");

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
			const mockState = {
				lessonFrame: { style: { display: "block" } },
				helpOverlay: { style: { display: "none" } },
				helpContent: { innerHTML: "" },
				data: { courseRules: {} },
			};

			certificate.init(mockState);
			certificate.showEndScreen(true, "92", "70");

			return {
				hasScore: mockState.helpContent.innerHTML.includes("<strong>92%</strong>"),
			};
		});

		expect(result.hasScore).toBe(true);
	});

	test("should include both scores in fail message", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				lessonFrame: { style: { display: "block" } },
				helpOverlay: { style: { display: "none" } },
				helpContent: { innerHTML: "" },
				data: { courseRules: {} },
			};

			certificate.init(mockState);
			certificate.showEndScreen(false, "55", "70");

			return {
				hasActualScore: mockState.helpContent.innerHTML.includes("<strong>55%</strong>"),
				hasRequiredScore: mockState.helpContent.innerHTML.includes("<strong>70%</strong>"),
			};
		});

		expect(result.hasActualScore).toBe(true);
		expect(result.hasRequiredScore).toBe(true);
	});

	test("should save lastActiveElement", async () => {
		const result = await page.evaluate(() => {
			const mockButton = document.createElement("button");
			mockButton.id = "mock-focus-element";
			document.body.appendChild(mockButton);
			mockButton.focus();

			const mockState = {
				lessonFrame: { style: { display: "block" } },
				helpOverlay: { style: { display: "none" } },
				helpContent: { innerHTML: "" },
				lastActiveElement: null,
				data: { courseRules: {} },
			};

			certificate.init(mockState);
			certificate.showEndScreen(true, "85", "70");

			const savedElement = mockState.lastActiveElement;

			document.body.removeChild(mockButton);

			return {
				lastActiveElementSaved: savedElement === mockButton,
			};
		});

		expect(result.lastActiveElementSaved).toBe(true);
	});

	test("should set isPaused to true", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				isPaused: false,
				lessonFrame: { style: { display: "block" } },
				helpOverlay: { style: { display: "none" } },
				helpContent: { innerHTML: "" },
				data: { courseRules: {} },
			};

			certificate.init(mockState);
			certificate.showEndScreen(true, "85", "70");

			return { isPaused: mockState.isPaused };
		});

		expect(result.isPaused).toBe(true);
	});

	test("should escape XSS payloads in score strings", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				lessonFrame: { style: { display: "block" } },
				helpOverlay: { style: { display: "none" } },
				helpContent: { innerHTML: "" },
				data: { courseRules: {} },
			};

			certificate.init(mockState);
			certificate.showEndScreen(true, '<img src=x onerror="alert(1)">', '70');

			const html = mockState.helpContent.innerHTML;
			return {
				noRawImgTag: !html.includes('<img src=x onerror'),
				hasEscaped: html.includes('&lt;img'),
			};
		});

		expect(result.noRawImgTag).toBe(true);
		expect(result.hasEscaped).toBe(true);
	});

	test("should handle null helpContent gracefully", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				isPaused: false,
				lessonFrame: { style: { display: "block" } },
				helpOverlay: { style: { display: "none" } },
				helpContent: null,
				data: { courseRules: {} },
			};

			certificate.init(mockState);
			try {
				certificate.showEndScreen(true, "85", "70");
				return { threwError: false };
			} catch (e) {
				return { threwError: true, message: e.message };
			}
		});

		expect(result.threwError).toBe(false);
	});

	test("should escape score strings with attribute-breaking payloads", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				lessonFrame: { style: { display: "block" } },
				helpOverlay: { style: { display: "none" } },
				helpContent: { innerHTML: "" },
				data: { courseRules: {} },
			};

			certificate.init(mockState);
			certificate.showEndScreen(true, '55"><img src=x onerror="alert(1)">', "70");

			const html = mockState.helpContent.innerHTML;
			return {
				hasRawAttrBreak: html.includes('55"><img'),
				hasEscapedAttr: html.includes("55&quot;&gt;&lt;img"),
			};
		});

		expect(result.hasRawAttrBreak).toBe(false);
		expect(result.hasEscapedAttr).toBe(true);
	});

	test("should escape required score strings with HTML injection payloads", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				lessonFrame: { style: { display: "block" } },
				helpOverlay: { style: { display: "none" } },
				helpContent: { innerHTML: "" },
				data: { courseRules: {} },
			};

			certificate.init(mockState);
			certificate.showEndScreen(false, "55", "<script>alert(1)</script>");

			const html = mockState.helpContent.innerHTML;
			return {
				hasRawScript: html.includes("<script>alert(1)</script>"),
				hasEscapedScript: html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"),
			};
		});

		expect(result.hasRawScript).toBe(false);
		expect(result.hasEscapedScript).toBe(true);
	});
});