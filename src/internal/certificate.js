const certificate = {
	_state: null,

	init: function(state) {
		this._state = state;
	},

	showEndScreen: function(hasPassed, scoreString, requiredScoreString) {
		const state = this._state;

		if (!state || !state.helpContent) {
			console.error("certificate.showEndScreen: helpContent element not available");
			return;
		}

		state.isPaused = true;
		state.lessonFrame.style.display = "none";
		state.helpOverlay.style.display = "flex";

		document.getElementById("prev").disabled = true;
		document.getElementById("next").disabled = true;
		state.lastActiveElement = document.activeElement;

		const certConfig = state.data.courseRules.certificate || {};
		const showCertButton = hasPassed && certConfig.enabled;

		const safeScore = utils.escapeHTML(scoreString);
		const safeRequired = utils.escapeHTML(requiredScoreString);

		let title = hasPassed ? "🎉 Course Completed!" : "⚠️ Course Incomplete";
		let message = hasPassed
			? `Congratulations! You have successfully finished the course with a score of <strong>${safeScore}%</strong>.`
			: `You reached the end, but you scored <strong>${safeScore}%</strong>. A score of <strong>${safeRequired}%</strong> is required to pass.`;

		let certButtonHTML = showCertButton
			? `<button class="help-action-btn" onclick="certificatePrint()" style="background-color: var(--brand); color: var(--brand-text);">🖨️ Print Certificate</button>`
			: "";

		state.helpContent.innerHTML = `
		<div class="help-wrapper centered" style="text-align: center;">
			<h1 id="modal-title" class="help-title no-border">${title}</h1>
			<p class="help-subtitle" style="margin-bottom: 30px; font-size: 1.2rem;">${message}</p>

			<div class="help-btn-group-col" style="align-items: center;">
				${certButtonHTML}
				<button class="help-action-btn auto-width" onclick="state.closeHelp()">🔙 Review Course Materials</button>
				<button class="help-action-btn danger auto-width" onclick="state.quit()">🚪 Exit Course</button>
				</div>
		</div>
		`;

		setTimeout(() => {
			const closeBtn = document.getElementById("close-help");
			if (closeBtn) closeBtn.focus();
		}, 50);
	},

	printCertificate: function() {
		const state = this._state;
		const certConfig = state.data.courseRules.certificate || {};
		const printArea = document.getElementById("certificate-print-area");

		if (!printArea) {
			console.error("Unable to find print area for the cert!");
			return;
		}

		const student = state.studentName || "Student";
		const overallGrade = state.calculateOverallGrade();
		const scoreValue = isNaN(overallGrade.ratio) ? 0 : overallGrade.ratio;
		const scoreString = String(Math.round(scoreValue * 100));
		const dateString = new Date().toLocaleDateString();

		const totalSeconds = state.data.delta.totalCourseSeconds || 0;
		const totalMinutes = String(Math.floor(totalSeconds / 60));
		const totalHours = String(parseFloat((totalSeconds / 3600).toFixed(2)));
		const minimumLength = String(state.data.courseRules.minimumMinutes || 0);

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
};

window.certificatePrint = certificate.printCertificate.bind(certificate);
