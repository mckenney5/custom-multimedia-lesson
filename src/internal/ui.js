const ui = {
	helpOverlay: null,
	helpContent: null,
	infoBanner: null,
	infoBar: null,
	isPaused: false,
	lastActiveElement: null,
	_printData: null,

	init: function() {
		this.helpOverlay = document.getElementById("help-overlay");
		this.helpContent = document.getElementById("help-content");
		this.infoBanner = document.getElementById("info-banner");
		this.infoBar = document.getElementById("info-bar");

		this.infoBanner.addEventListener("click", () => {
			this.infoBanner.style.display = "none";
		});
	},

	bannerMessage: function(message, isError = true) {
		let role = "";
		let icon = "";

		if(isError){
			this.infoBanner.className = "error";
			icon = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
			role = "alert";
		} else {
			this.infoBanner.className = "warning";
			icon = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>';
			role = "status";
		}

		this.infoBanner.innerHTML = `
			${icon}
			<span role="${role}">${utils.escapeHTML(message)}</span>
		`;

		this.infoBanner.style.display = "flex";
	},

	hideBanner: function() {
		this.infoBanner.style.display = "none";
	},

	isBannerVisible: function() {
		return this.infoBanner.style.display === "flex";
	},

	updateInfo: function({currentPageIndex, pageCount, progress}) {
		const currentPage = currentPageIndex + 1;
		const totalSteps = Math.max(1, pageCount - 1);
		const pct = Math.round((progress / totalSteps) * 100);

		this.infoBar.innerHTML = `
			<div id="info-bar-fill" style="width: ${pct}%;"></div>
			<span id="info-bar-text">Page ${currentPage} of ${pageCount} &nbsp;&nbsp;&bull;&nbsp;&nbsp; ${pct}% Complete</span>
		`;
 	},

	toggleHelp: function() {
		if (this.helpOverlay.style.display === "flex") {
			this.closeHelp(document.getElementById("lesson-frame"));
		} else {
			this.showHelpMenu();
		}
	},

	showHelpMenu: function() {
		this.lastActiveElement = document.activeElement;
		this.isPaused = true;
		document.getElementById("lesson-frame").style.display = "none";
		this.helpOverlay.style.display = "flex";

		document.getElementById("prev").disabled = true;
		document.getElementById("next").disabled = true;

		this.helpContent.innerHTML = `
			<div class="help-wrapper centered">
				<h1 id="modal-title" class="help-title no-border">Course Help</h1>
				<p class="help-subtitle" style="margin-bottom: 40px;">Select an option below to continue.
				<br><br> If you run into an issue during the course,
				go through each menu, from top to bottom, until the issue is resolved</p>
				<div class="help-btn-group-col">
					<button class="help-action-btn" onclick="ui.showPageHelp()">
						📄 Help with Current Page
					</button>

					<button class="help-action-btn" onclick="ui.showGeneralHelp()">
						❓ General Course Help
					</button>

					<button class="help-action-btn" onclick="ui._onRefresh()">
					🔄 Refresh This Web Page
					</button>

					<button class="help-action-btn danger" onclick="ui._onReset()">
						⚠️ Reset Course Progress
					</button>
				</div>
			</div>
		`;

		setTimeout(() => {
			const closeBtn = document.getElementById("close-help");
			if (closeBtn) closeBtn.focus();
		}, 50);
	},

	showPageHelp: function(page, pageDelta) {
		if (page) this._lastPage = page;
		if (pageDelta) this._lastPageDelta = pageDelta;
		page = page || this._lastPage;
		pageDelta = pageDelta || this._lastPageDelta;

		const rules = page.completionRules;
		const scorePct = page.maxScore > 0 ? (pageDelta.score / page.maxScore) : 0;

		let quizzesSatisfied = true;
		if (rules.requireSubmission) {
			const quizComponents = (page.components || []).filter(c => c.type === "quiz");
			quizzesSatisfied = quizComponents.every(q => pageDelta.components[q.id] && pageDelta.components[q.id].completed);
		}

		const checks = {
			watchTime: pageDelta.watchTime >= rules.watchTime,
			score: scorePct >= rules.score,
			scrolled: !rules.scrolled || pageDelta.scrolled,
			videoProgress: pageDelta.videoProgress >= rules.videoProgress,
			requireSubmission: quizzesSatisfied,
		};

		const formatIcon = (passed) => passed ? '<span aria-hidden="true" class="status-pass">✅</span>' : '<span aria-hidden="true" class="status-fail">❌</span>';

		let html = `
			<div class="help-wrapper">
			<h1 class="help-title">Page Completion Requirements</h1>
			<p class="help-subtitle">Review the requirements below. You must complete all items marked with an ❌ to unlock the next page.</p>

			<table class="help-table">
			<tr>
			<th>Requirement</th>
			<th>Target</th>
			<th>Current Progress</th>
			<th>Status</th>
			</tr>
		`;

		if (rules.watchTime > 0) html += `<tr><td>Time on Page</td><td>${utils.escapeHTML(String(rules.watchTime))} seconds</td><td>${utils.escapeHTML(String(pageDelta.watchTime))} seconds</td><td>${formatIcon(checks.watchTime)}</td></tr>`;
		if (rules.score > 0) html += `<tr><td>Minimum Score</td><td>${utils.escapeHTML(String(Math.round(rules.score * 100)))}%</td><td>${utils.escapeHTML(String(Math.round(scorePct * 100)))}%</td><td>${formatIcon(checks.score)}</td></tr>`;
		if (rules.scrolled) html += `<tr><td>Read Entire Article</td><td>Scroll to Bottom</td><td>${utils.escapeHTML(pageDelta.scrolled ? "Scrolled" : "Not Scrolled")}</td><td>${formatIcon(checks.scrolled)}</td></tr>`;
		if (rules.videoProgress > 0) html += `<tr><td>Watch Video</td><td>${utils.escapeHTML(String(Math.round(rules.videoProgress * 100)))}%</td><td>${utils.escapeHTML(String(Math.round(pageDelta.videoProgress * 100)))}%</td><td>${formatIcon(checks.videoProgress)}</td></tr>`;
		if (rules.requireSubmission) html += `<tr><td>Submit Quizzes</td><td>Submit all</td><td>${utils.escapeHTML(quizzesSatisfied ? "Submitted" : "Pending")}</td><td>${formatIcon(checks.requireSubmission)}</td></tr>`;

		html += `</table>
			<div class="help-btn-group-row">
				<button class="help-action-btn auto-width" onclick="ui.showPageHelp()">🔄 Refresh Status</button>
				<button class="help-action-btn auto-width" onclick="ui.showHelpMenu()">&larr; Back to Menu</button>
				</div>
			</div>
		`;

		this.helpContent.innerHTML = html;
	},

	showGeneralHelp: function() {
		this.helpContent.innerHTML = `
			<div class="help-wrapper">
			<iframe src="help.html" class="help-iframe"></iframe>
			<div class="help-btn-group-row" style="margin-top: 15px;">
				<button class="help-action-btn auto-width" onclick="ui.showHelpMenu()">&larr; Back to Menu</button>
			</div>
			</div>
		`;
	},

	closeHelp: function(lessonFrameEl) {
		this.helpOverlay.style.display = "none";
		this.helpContent.innerHTML = "";
		lessonFrameEl.style.display = "block";
		this.isPaused = false;

		document.getElementById("prev").disabled = false;
		document.getElementById("next").disabled = false;

		if (this.lastActiveElement) {
			this.lastActiveElement.focus();
			this.lastActiveElement = null;
		}
	},

	closeHelpFrame: function() {
		const frame = document.getElementById("lesson-frame");
		if (frame) this.closeHelp(frame);
	},

	showEndScreen: function(hasPassed, scoreString, requiredScoreString, {onQuit, onPrint, printData}) {
		if (!this.helpContent) {
			console.error("ui.showEndScreen: helpContent element not available");
			return;
		}

		this.isPaused = true;
		document.getElementById("lesson-frame").style.display = "none";
		this.helpOverlay.style.display = "flex";

		document.getElementById("prev").disabled = true;
		document.getElementById("next").disabled = true;
		this.lastActiveElement = document.activeElement;

		this._onQuit = onQuit;
		this._onPrint = onPrint;
		this._printData = printData;

		const certConfig = (printData && printData.certConfig) || {};
		const showCertButton = hasPassed && certConfig.enabled;

		const safeScore = utils.escapeHTML(scoreString);
		const safeRequired = utils.escapeHTML(requiredScoreString);

		let title = hasPassed ? "🎉 Course Completed!" : "⚠️ Course Incomplete";
		let message = hasPassed
			? `Congratulations! You have successfully finished the course with a score of <strong>${safeScore}%</strong>.`
			: `You reached the end, but you scored <strong>${safeScore}%</strong>. A score of <strong>${safeRequired}%</strong> is required to pass.`;

		let certButtonHTML = showCertButton
			? `<button class="help-action-btn" onclick="ui._onPrint()" style="background-color: var(--brand); color: var(--brand-text);">\u{1F5A8}\uFE0F Print Certificate</button>`
			: "";

		this.helpContent.innerHTML = `
		<div class="help-wrapper centered" style="text-align: center;">
			<h1 id="modal-title" class="help-title no-border">${title}</h1>
			<p class="help-subtitle" style="margin-bottom: 30px; font-size: 1.2rem;">${message}</p>

			<div class="help-btn-group-col" style="align-items: center;">
				${certButtonHTML}
				<button class="help-action-btn auto-width" onclick="ui.closeHelpFrame()">\u{1F519} Review Course Materials</button>
				<button class="help-action-btn danger auto-width" onclick="ui._onQuit()">\u{1F6AA} Exit Course</button>
				</div>
		</div>
		`;

		setTimeout(() => {
			const closeBtn = document.getElementById("close-help");
			if (closeBtn) closeBtn.focus();
		}, 50);
	},

	printCertificate: function() {
		const pd = this._printData;
		if (!pd) {
			console.error("ui.printCertificate: _printData not set");
			return;
		}
		const certConfig = pd.certConfig || {};
		const printArea = document.getElementById("certificate-print-area");

		if (!printArea) {
			console.error("Unable to find print area for the cert!");
			return;
		}

		const student = pd.studentName || "Student";
		const overallGrade = pd.overallGrade || {};
		const scoreValue = isNaN(overallGrade.ratio) ? 0 : overallGrade.ratio;
		const scoreString = String(Math.round(scoreValue * 100));
		const dateString = new Date().toLocaleDateString();

		const totalSeconds = pd.totalSeconds || 0;
		const totalMinutes = String(Math.floor(totalSeconds / 60));
		const totalHours = String(parseFloat((totalSeconds / 3600).toFixed(2)));
		const minimumLength = String(pd.minimumMinutes || 0);

		const titleText = utils.escapeHTML(certConfig.title || "Certificate of Completion");
		let bodyText = certConfig.body || "This certifies that {{studentName}} completed the course on {{date}} with a score of {{score}}%.";

		bodyText = utils.escapeHTML(bodyText);
		bodyText = bodyText.replace(/{{studentName}}/g, "<b>" + utils.escapeHTML(student) + "</b>");
		bodyText = bodyText.replace(/{{score}}/g, utils.escapeHTML(scoreString));
		bodyText = bodyText.replace(/{{date}}/g, utils.escapeHTML(dateString));
		bodyText = bodyText.replace(/{{totalMinutes}}/g, utils.escapeHTML(totalMinutes));
		bodyText = bodyText.replace(/{{totalHours}}/g, utils.escapeHTML(totalHours));
		bodyText = bodyText.replace(/{{minimumLength}}/g, utils.escapeHTML(minimumLength));
		bodyText = bodyText.replace(/\n/g, "<br>");

		const logoHTML = (() => {
			const url = utils.validateUrl(certConfig.logoUrl);
			const safeUrl = url ? utils.escapeHTML(url) : null;
			return safeUrl ? `<img src="${safeUrl}" style="max-height: 80px; margin-bottom: 20px;" alt="" />` : "";
		})();

		const signatureHTML = (() => {
			const url = utils.validateUrl(certConfig.signatureUrl);
			const safeUrl = url ? utils.escapeHTML(url) : null;
			return safeUrl ? `
			<div style="width: 250px; font-size: 1.2rem;">
				<div style="border-bottom: 2px solid #333; height: 50px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
					<img src="${safeUrl}" style="max-height: 45px; margin-bottom: -2px;" alt="Signature" />
				</div>
				Instructor Signature
			</div>
			` : "";
		})();

		const watermarkHTML = (() => {
			const url = utils.validateUrl(certConfig.watermarkUrl);
			const safeUrl = url ? utils.escapeHTML(url) : null;
			return safeUrl ? `<img src="${safeUrl}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); max-width: 75%; max-height: 75%; opacity: 0.12; z-index: 0; pointer-events: none;" alt="" />` : "";
		})();

		printArea.innerHTML = `
		${watermarkHTML}

		<h1 style="position: absolute; top: 30px; left: 50%; transform: translateX(-50%); width: 100%; max-width: 900px; text-align: center; z-index: 10; padding-bottom: 15px; margin: 0; font-size: 3.5rem; text-transform: uppercase; letter-spacing: 2px;">
		${titleText}
		</h1>

		<div style="position: relative; z-index: 1; margin: 130px auto; width: 100%; max-width: 900px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
		${logoHTML}
		<p style="font-size: 1.8rem; line-height: 1.6; margin: 0;">
		${bodyText}
		</p>
		</div>

		<div style="position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); display: flex; justify-content: space-around; align-items: flex-end; width: 100%; max-width: 900px; z-index: 10; padding-top: 15px;">

		<div style="width: 250px; font-size: 1.2rem;">
		<div style="border-bottom: 2px solid #333; height: 50px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px; margin-bottom: 5px;">
		${utils.escapeHTML(dateString)}
		</div>
		Date
		</div>

		<div style="width: 250px; font-size: 1.2rem;">
		<div style="border-bottom: 2px solid #333; height: 50px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px; margin-bottom: 5px;">
		<span id="cert-score">${utils.escapeHTML(scoreString)}%</span>
		</div>
		Score
		</div>

		${signatureHTML}
		</div>
			`;

		window.print();
	},

	toggleSettings: function() {
		if (this.helpOverlay.style.display === "flex") {
			this.closeHelp(document.getElementById("lesson-frame"));
		} else {
			this.showSettingsMenu(this._currentTheme || "light", {
				onThemeChange: this._onThemeChange,
			});
		}
	},

	showSettingsMenu: function(currentTheme, {onThemeChange}) {
		this._onThemeChange = onThemeChange;

		this.lastActiveElement = document.activeElement;
		this.isPaused = true;
		document.getElementById("lesson-frame").style.display = "none";
		this.helpOverlay.style.display = "flex";

		document.getElementById("prev").disabled = true;
		document.getElementById("next").disabled = true;

		const lightSel = currentTheme === "light" ? "selected" : "";
		const darkSel = currentTheme === "dark" ? "selected" : "";
		const hcSel = currentTheme === "high-contrast" ? "selected" : "";

		this.helpContent.innerHTML = `
			<div class="help-wrapper centered">
				<h1 id="modal-title" class="help-title no-border">Course Settings</h1>
				<p class="help-subtitle" style="margin-bottom: 40px;">Adjust your course preferences below.</p>

				<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 10px; width: 100%; max-width: 350px;">
					<label for="theme-select" style="font-size: 1.2rem; font-weight: bold; color: var(--text-main);">Color Theme</label>
					<select id="theme-select" onchange="ui._onThemeChange(this.value)" style="width: 100%; padding: 12px; font-size: 1.1rem; border-radius: 8px; border: 2px solid var(--border-color); background: var(--bg-main); color: var(--text-main); cursor: pointer;">
					<option value="light" ${lightSel}>Light Mode (Default)</option>
					<option value="dark" ${darkSel}>Dark Mode</option>
					<option value="high-contrast" ${hcSel}>High Contrast</option>
					</select>
				</div>
			</div>
		`;

		setTimeout(() => {
			const closeBtn = document.getElementById("close-help");
			if (closeBtn) closeBtn.focus();
		}, 50);
	},

 };
