const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("printCertificate", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should return early when print area not found", async () => {
		const result = await page.evaluate(() => {
			const errors = [];
			const originalError = console.error;
			console.error = (msg) => errors.push(msg);

			const mockState = {
				data: {
					courseRules: {},
					delta: {},
				},
			};

			certificate.init(mockState);

			const originalPrintArea = document.getElementById("certificate-print-area");
			const hadPrintArea = originalPrintArea !== null;

			if (hadPrintArea) {
				originalPrintArea.style.display = "none";
				originalPrintArea.id = "certificate-print-area-bak";
			}

			const noPrintArea = document.getElementById("certificate-print-area");

			certificate.printCertificate();

			if (hadPrintArea) {
				const bak = document.getElementById("certificate-print-area-bak");
				bak.id = "certificate-print-area";
			}

			console.error = originalError;

			return {
				printAreaMissing: noPrintArea === null,
				errorLogged: errors.length > 0 && errors[0].includes("Unable to find print area"),
			};
		});

		expect(result.printAreaMissing).toBe(true);
		expect(result.errorLogged).toBe(true);
	});

	test("should escape HTML in certConfig.body to prevent injection", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "John",
				data: {
					courseRules: {
						certificate: {
							body: "<em>Congratulations</em> {{studentName}}",
						},
					},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			const html = printArea.innerHTML;
			return {
				hasRawEm: html.includes("<em>Congratulations</em>"),
				hasEscapedEm: html.includes("&lt;em&gt;Congratulations&lt;/em&gt;"),
				hasStudentName: html.includes("John"),
			};
		});

		expect(result.hasRawEm).toBe(false);
		expect(result.hasEscapedEm).toBe(true);
		expect(result.hasStudentName).toBe(true);
	});

	test("should replace {{studentName}} placeholder", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "John Doe",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.85 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				hasStudentName: printArea.innerHTML.includes("John Doe"),
			};
		});

		expect(result.hasStudentName).toBe(true);
	});

	test("should replace {{score}} placeholder", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.92 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				hasScore: printArea.innerHTML.includes("92%"),
			};
		});

		expect(result.hasScore).toBe(true);
	});

	test("should replace {{date}} placeholder", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			const today = new Date().toLocaleDateString();
			return {
				hasDate: printArea.innerHTML.includes(today),
			};
		});

		expect(result.hasDate).toBe(true);
	});

	test("should replace {{totalMinutes}} placeholder", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: { totalCourseSeconds: 150 },
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				hasMinutes: printArea.innerHTML.includes("2"),
			};
		});

		expect(result.hasMinutes).toBe(true);
	});

	test("should replace {{totalHours}} placeholder", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: { totalCourseSeconds: 7200 },
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				hasHours: printArea.innerHTML.includes("2"),
			};
		});

		expect(result.hasHours).toBe(true);
	});

	test("should replace {{minimumLength}} placeholder", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: { minimumMinutes: 30 },
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				hasMinimumLength: printArea.innerHTML.includes("30"),
			};
		});

		expect(result.hasMinimumLength).toBe(true);
	});

	test("should convert newlines to <br> tags", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {
						certificate: {
							body: "Line one\nLine two",
						},
					},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			const html = printArea.innerHTML;
			return {
				hasBr: html.includes("<br>"),
				hasBrTag: html.includes("<br/>") || html.includes("<br />"),
				bodyHasLineOne: html.includes("Line one"),
				bodyHasLineTwo: html.includes("Line two"),
			};
		});

		expect(result.hasBr || result.hasBrTag || result.hasEscapedBrackets).toBe(true);
		expect(result.bodyHasLineOne).toBe(true);
		expect(result.bodyHasLineTwo).toBe(true);
	});

	test("should include logo when logoUrl is set", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {
						certificate: {
							logoUrl: "https://example.com/logo.png",
						},
					},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				hasLogoImg: printArea.innerHTML.includes("logo.png"),
				hasMaxHeight: printArea.innerHTML.includes("max-height: 80px"),
			};
		});

		expect(result.hasLogoImg).toBe(true);
		expect(result.hasMaxHeight).toBe(true);
	});

	test("should not include logo when logoUrl is not set", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				hasImgTag: printArea.innerHTML.includes("<img"),
			};
		});

		expect(result.hasImgTag).toBe(false);
	});

	test("should include signature when signatureUrl is set", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {
						certificate: {
							signatureUrl: "https://example.com/sig.png",
						},
					},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				hasSigImg: printArea.innerHTML.includes("sig.png"),
				hasSigLabel: printArea.innerHTML.includes("Instructor Signature"),
			};
		});

		expect(result.hasSigImg).toBe(true);
		expect(result.hasSigLabel).toBe(true);
	});

	test("should not include signature when signatureUrl is not set", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				hasSigText: printArea.innerHTML.includes("Instructor Signature"),
			};
		});

		expect(result.hasSigText).toBe(false);
	});

	test("should include watermark when watermarkUrl is set", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {
						certificate: {
							watermarkUrl: "https://example.com/wm.png",
						},
					},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				hasWmImg: printArea.innerHTML.includes("wm.png"),
				hasOpacity: printArea.innerHTML.includes("opacity: 0.12"),
			};
		});

		expect(result.hasWmImg).toBe(true);
		expect(result.hasOpacity).toBe(true);
	});

	test("should not include watermark when watermarkUrl is not set", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				imgCount: (printArea.innerHTML.match(/<img/g) || []).length,
			};
		});

		expect(result.imgCount).toBe(0);
	});

	test("should use custom title from certConfig", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {
						certificate: {
							title: "My Custom Certificate",
						},
					},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				hasCustomTitle: printArea.innerHTML.includes("My Custom Certificate"),
				hasDefaultTitle: printArea.innerHTML.includes("Certificate of Completion"),
			};
		});

		expect(result.hasCustomTitle).toBe(true);
		expect(result.hasDefaultTitle).toBe(false);
	});

	test("should call window.print()", async () => {
		const result = await page.evaluate(() => {
			const printCalled = [];
			const originalPrint = window.print;
			window.print = () => printCalled.push(true);

			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			window.print = originalPrint;

			return {
				printCalled: printCalled.length > 0,
			};
		});

		expect(result.printCalled).toBe(true);
	});

	test("should use default student name when studentName is empty", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				hasDefaultName: printArea.innerHTML.includes("Student"),
			};
		});

		expect(result.hasDefaultName).toBe(true);
	});

	test("should handle zero totalCourseSeconds", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: { totalCourseSeconds: 0 },
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			const html = printArea.innerHTML;
			return {
				hasZeroMinutes: html.includes("0") && html.includes("Date"),
				hasZeroHours: html.includes("0"),
			};
		});

		expect(result.hasZeroMinutes).toBe(true);
		expect(result.hasZeroHours).toBe(true);
	});

	test("should calculate score from calculateOverallGrade", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.752 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				scoreShown: printArea.innerHTML.includes("75%"),
			};
		});

		expect(result.scoreShown).toBe(true);
	});

	test("should display 0% when calculateOverallGrade returns NaN ratio", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: NaN, earnedScore: 0, maxScore: 0 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			return {
				scoreShown: printArea.innerHTML.includes("0%"),
				noNaN: !printArea.innerHTML.includes("NaN"),
			};
		});

		expect(result.scoreShown).toBe(true);
		expect(result.noNaN).toBe(true);
	});

	test("should escape double-quotes in logoUrl to prevent attribute breakout", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {
						certificate: {
							logoUrl: 'https://example.com/" onerror="alert(1)"',
						},
					},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			const html = printArea.innerHTML;
			const imgMatch = html.match(/<img[^>]*>/);
			return {
				hasImg: imgMatch !== null,
				imgTag: imgMatch ? imgMatch[0] : "",
				hasRawQuoteInSrc: imgMatch && imgMatch[0].includes('src="https://example.com/"'),
				hasEscapedQuote: imgMatch && imgMatch[0].includes("&quot;"),
			};
		});

		expect(result.hasImg).toBe(true);
		expect(result.hasRawQuoteInSrc).toBe(false);
		expect(result.hasEscapedQuote).toBe(true);
	});

	test("should escape double-quotes in signatureUrl to prevent attribute breakout", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {
						certificate: {
							signatureUrl: 'https://example.com/" onerror="alert(1)"',
						},
					},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			const html = printArea.innerHTML;
			const imgMatch = html.match(/<img[^>]*>/);
			return {
				hasImg: imgMatch !== null,
				imgTag: imgMatch ? imgMatch[0] : "",
				hasRawQuoteInSrc: imgMatch && imgMatch[0].includes('src="https://example.com/"'),
				hasEscapedQuote: imgMatch && imgMatch[0].includes("&quot;"),
			};
		});

		expect(result.hasImg).toBe(true);
		expect(result.hasRawQuoteInSrc).toBe(false);
		expect(result.hasEscapedQuote).toBe(true);
	});

	test("should escape double-quotes in watermarkUrl to prevent attribute breakout", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {
						certificate: {
							watermarkUrl: 'https://example.com/" onerror="alert(1)"',
						},
					},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			const html = printArea.innerHTML;
			const imgMatch = html.match(/<img[^>]*>/);
			return {
				hasImg: imgMatch !== null,
				imgTag: imgMatch ? imgMatch[0] : "",
				hasRawQuoteInSrc: imgMatch && imgMatch[0].includes('src="https://example.com/"'),
				hasEscapedQuote: imgMatch && imgMatch[0].includes("&quot;"),
			};
		});

		expect(result.hasImg).toBe(true);
		expect(result.hasRawQuoteInSrc).toBe(false);
		expect(result.hasEscapedQuote).toBe(true);
	});

	test("should escape {{studentName}} value to prevent script injection", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "<script>alert(1)</script>",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			const html = printArea.innerHTML;
			return {
				hasRawScript: html.includes("<script>alert(1)</script>"),
				hasEscapedScript: html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"),
			};
		});

		expect(result.hasRawScript).toBe(false);
		expect(result.hasEscapedScript).toBe(true);
	});

	test("should escape {{studentName}} value to prevent attribute breakout", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: 'John" onclick="alert(1)"',
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			const text = printArea.textContent;
			const hasInjectedOnclick = printArea.querySelector("[onclick]");
			return {
				studentNameInText: text.includes('John" onclick'),
				noInjectedAttributes: hasInjectedOnclick === null,
			};
		});

		expect(result.studentNameInText).toBe(true);
		expect(result.noInjectedAttributes).toBe(true);
	});

	test("should escape {{date}} value to prevent HTML injection", async () => {
		const result = await page.evaluate(() => {
			const realDate = Date.prototype.toLocaleDateString;
			Date.prototype.toLocaleDateString = () => "<script>alert('xss')</script>";

			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			Date.prototype.toLocaleDateString = realDate;

			const printArea = document.getElementById("certificate-print-area");
			const html = printArea.innerHTML;
			return {
				hasRawScript: html.includes("<script>alert('xss')</script>"),
				hasEscapedScript: html.includes("&lt;script&gt;alert('xss')&lt;/script&gt;"),
			};
		});

		expect(result.hasRawScript).toBe(false);
		expect(result.hasEscapedScript).toBe(true);
	});

	test("should wrap score in identifiable #cert-score element", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.92 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			const scoreEl = printArea.querySelector("#cert-score");
			return {
				hasScoreEl: scoreEl !== null,
				scoreText: scoreEl ? scoreEl.textContent : "",
			};
		});

		expect(result.hasScoreEl).toBe(true);
		expect(result.scoreText).toBe("92%");
	});

	test("should escape studentName with event handler attributes to prevent XSS", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: 'John<img src=x onerror="alert(1)">',
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			const html = printArea.innerHTML;
			return {
				hasRawImg: html.includes('<img src=x onerror='),
				hasEscapedImg: html.includes('&lt;img src=x onerror'),
			};
		});

		expect(result.hasRawImg).toBe(false);
		expect(result.hasEscapedImg).toBe(true);
	});

	test("should escape certConfig.title to prevent HTML injection", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {
						certificate: {
							title: "<script>alert(1)</script>",
						},
					},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			const html = printArea.innerHTML;
			return {
				hasRawScript: html.includes("<script>alert(1)</script>"),
				hasEscapedScript: html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"),
			};
		});

		expect(result.hasRawScript).toBe(false);
		expect(result.hasEscapedScript).toBe(true);
	});

	test("should escape body content to prevent HTML injection", async () => {
		const result = await page.evaluate(() => {
			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {
						certificate: {
							body: '<img src=x onerror="alert(1)"> {{studentName}}',
						},
					},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			const printArea = document.getElementById("certificate-print-area");
			const html = printArea.innerHTML;
			return {
				hasRawImg: html.includes('<img src=x onerror='),
				hasEscapedImg: html.includes('&lt;img src=x onerror'),
			};
		});

		expect(result.hasRawImg).toBe(false);
		expect(result.hasEscapedImg).toBe(true);
	});

	test("should escape dateString to prevent script injection in body", async () => {
		const result = await page.evaluate(() => {
			const realDate = Date.prototype.toLocaleDateString;
			Date.prototype.toLocaleDateString = () => "<img src=x onerror='alert(1)'>";

			const mockState = {
				studentName: "Student",
				data: {
					courseRules: {},
					delta: {},
				},
				calculateOverallGrade: () => ({ ratio: 0.5 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			Date.prototype.toLocaleDateString = realDate;

			const printArea = document.getElementById("certificate-print-area");
			const html = printArea.innerHTML;
			return {
				hasRawImg: html.includes("<img src=x onerror="),
				hasEscapedImg: html.includes("&lt;img src=x onerror="),
			};
		});

		expect(result.hasRawImg).toBe(false);
		expect(result.hasEscapedImg).toBe(true);
	});

	test("should handle concurrent injection of all placeholders with malicious payloads", async () => {
		const result = await page.evaluate(() => {
			const realDate = Date.prototype.toLocaleDateString;
			Date.prototype.toLocaleDateString = () => "<script>date</script>";

			const mockState = {
				studentName: "<b>name</b>",
				data: {
					courseRules: {
						certificate: {
							body: "{{studentName}} {{score}} {{date}} {{totalMinutes}} {{totalHours}} {{minimumLength}}",
						},
					},
					delta: { totalCourseSeconds: 3600 },
				},
				calculateOverallGrade: () => ({ ratio: 0.75 }),
			};

			certificate.init(mockState);
			certificate.printCertificate();

			Date.prototype.toLocaleDateString = realDate;

			const printArea = document.getElementById("certificate-print-area");
			const html = printArea.innerHTML;
			return {
				hasRawNameTag: html.includes("<b>name</b>"),
				hasEscapedName: html.includes("&lt;b&gt;name&lt;/b&gt;"),
				hasRawDateScript: html.includes("<script>date</script>"),
				hasEscapedDate: html.includes("&lt;script&gt;date&lt;/script&gt;"),
			};
		});

		expect(result.hasRawNameTag).toBe(false);
		expect(result.hasEscapedName).toBe(true);
		expect(result.hasRawDateScript).toBe(false);
		expect(result.hasEscapedDate).toBe(true);
	});
});