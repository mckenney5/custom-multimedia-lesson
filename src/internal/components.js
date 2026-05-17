/* ==========================================================================
 BASE CLASS: The foundation for all course widgets          *
 ========================================================================== */
class CourseComponent extends HTMLElement {
	constructor() {
		super();
		this.rendered = false;
	}

	// --- LIFECYCLE HOOKS ---

	connectedCallback() {
		try {
			if (!this.rendered) {
				this.render();
				this.attachListeners();

				this._boundDataHandler = this.handleStudentData.bind(this);
				window.addEventListener("student-data", this._boundDataHandler);

				this.rendered = true;
			}
		} catch (e) {
			console.error(`[${this.tagName}] Error in connectedCallback:`, e);
		}
	}

	disconnectedCallback() {
		try {
			if(this._boundDataHandler){
				window.removeEventListener("student-data", this._boundDataHandler);
			}

			if ("speechSynthesis" in window) {
				window.speechSynthesis.cancel();
			}
		} catch (e) {
			console.error(`[${this.tagName}] Error in disconnectedCallback:`, e);
		}
	}

	// --- HELPER METHODS ---

	/**
	 * Safe wrapper to send data to the Parent
	 * @param {string} type - Event ID (e.g., "VIDEO_PLAY")
	 * @param {any} message - The data payload
	 */

	speak(text) {
		if (!("speechSynthesis" in window)) {
			console.warn("Text-to-Speech not supported in this browser.");
			return;
		}

		// Always stop whatever is currently talking
		window.speechSynthesis.cancel();

		// If the user clicked the exact same button while it was talking, just leave it silenced
		if (this._lastSpeech === text) {
			this._lastSpeech = null;
			return;
		}

		// Otherwise, queue up the new speech
		this._lastSpeech = text;
		const utterance = new SpeechSynthesisUtterance(text);

		// Clear the tracking variable when the speech finishes naturally
		utterance.onend = () => { this._lastSpeech = null; };

		window.speechSynthesis.speak(utterance);
	}

	requestStudentData() {
		this.send("GET_STUDENT_DATA", "");
	}

	handleStudentData(event) {
		const data = event.detail;
		if (!data) return;
	}

	// 1. UPDATE CourseComponent 'send' method
	send(type, message) {
		const myId = this.getAttribute("id");
		let payload = message;

		// Wrap the message if this component has an ID
		if (myId) {
			payload = {
				id: myId,
				value: message,
			};
		}

		if (window.child && typeof window.child.send === "function") {
			window.child.send(type, payload);
		} else {
			console.warn(`[${this.tagName}] Cannot send message.`);
		}
	}

	/**
	 * Quick access to attributes with defaults
	 */
	attr(name, defaultValue = "") {
		return this.getAttribute(name) || defaultValue;
	}

	// --- ABSTRACT METHODS (To be overridden) ---

	render() {
		this.innerHTML = "Loading...";
		console.warn(`[${this.tagName}] render() method not implemented.`);
	}

	attachListeners() {
		// Optional hook for adding event listeners after render
	}
}

/* ==========================================================================
 VIDEO COMPONENT: <course-video src="..."></course-video>   *
 ========================================================================== */
class CourseVideo extends CourseComponent {

	// Tell browser which attributes to watch for changes
	static get observedAttributes() {
		return ["src"];
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (name === "src" && this.videoElem) {
			this.videoElem.src = newValue;
		}
	}

	render() {
		const src = this.attr("src");
		const poster = this.attr("poster");
		const captions = this.attr("captions"); // allows for adding CC to the atributes like <course-video src="vid.mp4" captions="subs.vtt"></course-video>
		this.seek = 5; // How far FF and RW move the video

		// We use Light DOM, so we write directly to this.innerHTML
		this.innerHTML = `
		<div id="video-container">
			<div id="fs-hover-trigger"></div>
			<div id="seek-overlay" class="seek-overlay" aria-hidden="true"></div>
			<div id="loading-overlay" role="status" aria-live="polite" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); color: white; align-items: center; justify-content: center; z-index: 10; pointer-events: none; font-size: 1.2rem;">
				<span class="spinner">⏳ Buffering...</span>
			</div>

			<video id="vid-player" src="${src}" poster="${poster}">
				${captions ? `<track id="vid-captions" kind="captions" src="${captions}" srclang="en" label="English" default>` : ""}
			</video>

			<div id="video-controls">
				<div id="progress-container" aria-hidden="true">
					<div id="progress-fill"></div>
				</div>
				<button id="play-pause" class="icon-btn" type="button" aria-label="Play" title="Play">
					<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
				</button>

				<button id="rewind" class="icon-btn" type="button" aria-label="Rewind ${this.seek} Seconds" title="Rewind ${this.seek}s">
					<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
				</button>

				<button id="forward" class="icon-btn" type="button" aria-label="Forward ${this.seek} Seconds" title="Forward ${this.seek}s">
					<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
				</button>

				<button id="mute-btn" class="icon-btn" type="button" aria-label="Mute" title="Mute">
					<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
				</button>

				<span id="time-display" style="font-family: monospace; font-variant-numeric: tabular-nums; min-width: 10ch; text-align: center; margin: 0 10px;">0:00 / 0:00</span>

				<select id="speed-select" class="speed-dropdown" aria-label="Playback Speed" title="Playback Speed">
					<option value="0.5">0.5x</option>
					<option value="0.75">0.75x</option>
					<option value="1" selected>1x</option>
					<option value="1.25">1.25x</option>
					<option value="1.5">1.5x</option>
					<option value="1.75">1.75x</option>
					<option value="2">2x</option>
				</select>

				<button id="full-screen" class="icon-btn" type="button" aria-label="Full Screen" title="Full Screen">
					<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
				</button>
			</div>
		</div>
		`;

		// Cache references to elements so we don't querySelector every time
		this.videoElem = this.querySelector("#vid-player");
		this.playBtn = this.querySelector("#play-pause");
		this.timeDisplay = this.querySelector("#time-display");
		this.rewindButton = this.querySelector("#rewind");
		this.forwardButton = this.querySelector("#forward");
		this.speedSelect = this.querySelector("#speed-select");
		this.fullScreenButton = this.querySelector("#full-screen");
		this.videoContainer = this.querySelector("#video-container");
		this.muteBtn = this.querySelector("#mute-btn");
		this.loadingOverlay = this.querySelector("#loading-overlay");
		this.seekOverlay = this.querySelector("#seek-overlay");
		this.progressFill = this.querySelector("#progress-fill");


		// State tracking
		this.lastLoggedPercent = 0;

		// Stat tracking
		this.activePlayMs = 0;
		this.visiblePlayMs = 0;
		this.weightedSpeedSum = 0;
		this.lastTick = 0;
	}

	attachListeners() {

		// Hardcoded SVG Icons
		const ICONS = {
			play: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
			pause: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
			volumeOn: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
			volumeOff: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
			fullScreen: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
			exitFullScreen: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
		};

		// -- Video Buffering
		// Fires when the browser starts fetching the media
		this.videoElem.addEventListener("loadstart", () => {
			this.loadingOverlay.style.display = "flex";
		});

		// Fires when playback stops because it needs to buffer the next frame
		this.videoElem.addEventListener("waiting", () => {
			this.loadingOverlay.style.display = "flex";
		});

		// Fires when enough data has loaded to start/resume playing
		this.videoElem.addEventListener("canplay", () => {
			this.loadingOverlay.style.display = "none";
		});

		// Backup: explicitly hide when playing resumes
		this.videoElem.addEventListener("playing", () => {
			this.loadingOverlay.style.display = "none";
		});
		// --

		// Play/Pause Toggle
		this.playBtn.addEventListener("click", () => {
			if (this.videoElem.paused) {
				this.videoElem.play();
			} else {
				this.videoElem.pause();
			}
		});

		// Play / Pause on video area click
		this.videoElem.addEventListener("click", () => {
			if (this.videoElem.paused) {
				this.videoElem.play();
			} else {
				this.videoElem.pause();
			}
		});

		this.videoElem.addEventListener("play", () => {
			// Track play time (your existing code)
			this.lastTick = performance.now();

			// Automatically update the UI to the Pause state
			this.playBtn.innerHTML = ICONS.pause;
			this.playBtn.setAttribute("aria-label", "Pause");
			this.playBtn.title = "Pause";

			// Send analytics
			this.send("VIDEO_PLAYING", this.videoElem.currentTime);
		});

		this.videoElem.addEventListener("pause", () => {
			// Automatically update the UI to the Play state
			this.playBtn.innerHTML = ICONS.play;
			this.playBtn.setAttribute("aria-label", "Play");
			this.playBtn.title = "Play";

			// Send analytics
			this.send("VIDEO_PAUSED", this.videoElem.currentTime);

			// Run your existing stats reporter
			reportStats();
		});

		// Resume tracking when recovering from a buffer/skip
		this.videoElem.addEventListener("playing", () => {
			this.lastTick = performance.now();
		});

		// PAUSE tracking if the user skips around (seeking)
		this.videoElem.addEventListener("seeking", () => {
			this.lastTick = null;
		});

		// PAUSE tracking if their internet is slow and it has to buffer
		this.videoElem.addEventListener("waiting", () => {
			this.lastTick = null;
		});

		const triggerSeekOverlay = (text, buttonElem) => {
			// Set the dynamic text (e.g., "+5s")
			this.seekOverlay.textContent = text;

			// Disable the button to prevent buffering crashes
			buttonElem.disabled = true;

			// Reset and trigger the CSS animation
			this.seekOverlay.classList.remove("seek-animate");
			void this.seekOverlay.offsetWidth; // Browser HACK to force a UI repaint
			this.seekOverlay.classList.add("seek-animate");

			// Cooldown timer: Re-enable the button after 400ms (matches CSS animation duration)
			setTimeout(() => {
				buttonElem.disabled = false;
				// Return focus to the button so keyboard users don't lose their place
				buttonElem.focus();
			}, 400);
		};

		this.rewindButton.addEventListener("click", () => {
			this.videoElem.pause();
			this.send("VIDEO_REWIND", this.videoElem.currentTime);
			this.videoElem.currentTime -= this.seek;

			// Trigger overlay
			triggerSeekOverlay(`-${this.seek}s`, this.rewindButton);

			this.videoElem.play();
		});

		this.forwardButton.addEventListener("click", () => {
			this.videoElem.pause();
			this.send("VIDEO_FORWARD", this.videoElem.currentTime);
			this.videoElem.currentTime += this.seek;

			// Trigger overlay
			triggerSeekOverlay(`+${this.seek}s`, this.forwardButton);

			this.videoElem.play();
		});

		this.speedSelect.addEventListener("change", () => {
			// Convert the string value from the dropdown into a float
			const newSpeed = parseFloat(this.speedSelect.value);

			// Log the change
			this.send("VIDEO_SPEED_CHANGE", `from ${this.videoElem.playbackRate} to ${newSpeed}`);

			// Apply to video
			this.videoElem.playbackRate = newSpeed;
		});

		this.fullScreenButton.addEventListener("click", () => {
			// Toggle full screen
			!document.fullscreenElement ? this.videoContainer.requestFullscreen() : document.exitFullscreen();
		});

		this.videoContainer.addEventListener("fullscreenchange", () => {
			if (!document.fullscreenElement) {
				this.send("VIDEO_NORMAL_SCREEN", "");
				this.fullScreenButton.innerHTML = ICONS.fullScreen;
				this.fullScreenButton.setAttribute("aria-label", "Full Screen");
				this.fullScreenButton.title = "Full Screen";
			} else {
				this.send("VIDEO_FULL_SCREEN", "");
				this.fullScreenButton.innerHTML = ICONS.exitFullScreen;
				this.fullScreenButton.setAttribute("aria-label", "Exit Full Screen");
				this.fullScreenButton.title = "Exit Full Screen";
			}
		});

		this.muteBtn.addEventListener("click", () => {
			this.videoElem.muted = !this.videoElem.muted;
			if (this.videoElem.muted) {
				this.muteBtn.innerHTML = ICONS.volumeOff;
				this.muteBtn.setAttribute("aria-label", "Unmute");
				this.muteBtn.title = "Unmute";
			} else {
				this.muteBtn.innerHTML = ICONS.volumeOn;
				this.muteBtn.setAttribute("aria-label", "Mute");
				this.muteBtn.title = "Mute";
			}
			this.send("VIDEO_MUTED", this.videoElem.muted);
		});

		this.videoContainer.addEventListener("keydown", (e) =>{
			// Disable default keys for ones that need them
			const preventDefaultKeys = ["Space", "ArrowRight", "ArrowLeft", "KeyM"];
			if(preventDefaultKeys.includes(e.code)) {
				e.preventDefault();
			}

			if(e.repeat){ return; }

			// Check the keys
			switch(e.code){
				case "Space":
					this.playBtn.click();
					break;
				case "ArrowRight":
					this.forwardButton.click();
					break;
				case "ArrowLeft":
					this.rewindButton.click();
					break;
				case "KeyM":
					this.muteBtn.click();
					break;
			}
		});

		// Progress Tracking
		this.videoElem.addEventListener("timeupdate", () => {

			// Analytics Math to see how much screen time the video has
			if (!this.videoElem.paused && this.lastTick) {
				const now = performance.now();
				const delta = now - this.lastTick;
				this.lastTick = now;

				this.activePlayMs += delta;

				// document.hidden accurately tracks if the tab is minimized or switched
				if (!document.hidden) {
					this.visiblePlayMs += delta;
				}

				this.weightedSpeedSum += (this.videoElem.playbackRate * delta);
			}

			const currentTime = this.videoElem.currentTime;
			const duration = this.videoElem.duration || 0;

			if (!duration || !isFinite(duration)) return;

			const pct = (currentTime / duration);

			// Fill the progress bar
			this.progressFill.style.width = `${pct * 100}%`;

			// Update UI with "Current / Total"
			this.timeDisplay.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;

			// Send to Parent
			this.send("VIDEO_PROGRESS", pct);
		});

		const reportStats = () => {
			if (this.activePlayMs > 0) {
				const avgSpeed = (this.weightedSpeedSum / this.activePlayMs).toFixed(2);
				const visiblePct = Math.round((this.visiblePlayMs / this.activePlayMs) * 100);
				if (window.child && typeof window.child.send === "function") {
					this.send("VIDEO_STATS", {
						avgSpeed: parseFloat(avgSpeed),
						visiblePct: visiblePct,
					});
				}
			}
		};

		// Save stats on pause
		this.videoElem.addEventListener("pause", reportStats);

		// Completion
		this.videoElem.addEventListener("ended", () => {
			this.playBtn.textContent = "Replay";
			this.send("VIDEO_PROGRESS", 1.0);
			reportStats();
		});
	}

	// Helper specific to this component
	formatTime(seconds) {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60).toString().padStart(2, "0");
		return `${m}:${s}`;
	}
}

/* ==========================================================================
  ARTICLE COMPONENT: <course-article> ... content ... *</course-article>
  ========================================================================== */
class CourseArticle extends CourseComponent {

	render() {
		// Light DOM: We don't need to inject HTML.
		// The text content inside the tag in page1.html is already there.
		// We just ensure it behaves like a block element.
		this.style.display = "block";
		const infoRaw = this.attr("needsStudentInfo") || "";
		const getInfo = infoRaw.toLocaleLowerCase() === "true" ? true : false;

		if(getInfo){
			if (this._handleStudentData) {
				window.removeEventListener("student-data", this._handleStudentData);
			}
			this._handleStudentData = this.handleStudentData.bind(this);
			window.addEventListener("student-data", this._handleStudentData);
			this.requestStudentData();
		}
	}

	handleStudentData(event) {
		if (!event.detail) return;
		// Override the handler to update the UI
		const { name, grade } = event.detail;

		const n = name ? name : "Guest";
		const g = grade ? grade : "N/A";

		// Find a specific span in the HTML and update it
		// Example HTML: <h1>Welcome <span id="name-field"></span></h1>
		const nameField = this.querySelector("#name-field");
		if(nameField) nameField.textContent = n;

		const gradeField = this.querySelector("#grade-field");
		if(gradeField) gradeField.textContent = g;
	}

	attachListeners() {
		// Bind the scroll function so we can remove it cleanly later
		this._onScroll = this.checkScroll.bind(this);

		// Attach to Window (Global scroll)
		window.addEventListener("scroll", this._onScroll);

		// Check immediately (In case the text is short and fits on one screen)
		this.checkScroll();

		// Set up text to speech if a button called read-article is present
		const readBtn = this.querySelector("#read-article");
		if (readBtn) {
			readBtn.addEventListener("click", () => {
				this.speak(this.textContent);
			});
		}

	}

	checkScroll() {
		// Standard "Am I at the bottom?" math
		// We add a tiny buffer (10px) to handle browser zoom/rounding errors
		if(document.body.scrollHeight === 0) return; // Guard against unrendered content

		// We use body instead of documentElement since this lives in an iframe
		const distanceToBottom = document.body.scrollHeight - (window.scrollY + window.innerHeight);

		if (distanceToBottom <= 10) {
			// Send 'true' as the message payload
			this.send("PAGE_SCROLLED", true);

			// Cleanup: Stop listening once they finish (Optimizes performance)
			window.removeEventListener("scroll", this._onScroll);
		}
	}

	disconnectedCallback() {
		// Safety: If the user leaves the page, kill the listener
		if (this._onScroll) {
			window.removeEventListener("scroll", this._onScroll);
		}
		if (this._handleStudentData) {
			window.removeEventListener("student-data", this._handleStudentData);
		}
		super.disconnectedCallback();
	}
}

/* ==========================================================================
 QUIZ COMPONENT: <course-quiz></course-quiz>   *
 ========================================================================== */
class CourseQuiz extends CourseComponent {
	// Tell browser which attributes to watch for changes


	render() {

	}

	connectedCallback() {
		super.connectedCallback();

		// Listen for data
		this._boundQuizHandler = this.handleQuizData.bind(this);
		window.addEventListener("quiz-data", this._boundQuizHandler);

		// Listen for results
		this._boundQuizResults = this.handleQuizResults.bind(this);
		window.addEventListener("quiz-results", this._boundQuizResults);

		// Ask for data
		// This will now automatically send the ID because of the base class update
		this.send("GET_QUIZ_DATA", "");
	}

	disconnectedCallback() {
		window.removeEventListener("quiz-data", this._boundQuizHandler);
		window.removeEventListener("quiz-results", this._boundQuizResults);
		super.disconnectedCallback();
	}

	// 2. UPDATE CourseQuiz handlers
	handleQuizData(event) {
		if (!event?.detail) return;

		let data = event.detail;
		let targetId = null;

		// Unwrap if it's a directed message
		if (data && data.id && data.value) {
			targetId = data.id;
			data = data.value;
		}

		// Filter: If message has a target ID, it MUST match mine
		const myId = this.getAttribute("id");
		if (targetId && targetId !== myId) return;

		if (!data) return;

		// Store Data
		this.attemptsLeft = data.attemptsLeft;
		this.options = data.options || [];
		this.hasAttempted = data.hasAttempted;

		// Proceed
		this.renderForm(data.questions, data.userAnswers);
	}

	handleQuizResults(event) {
		let data = event.detail;
		let targetId = null;

		if (data && data.id && data.value) {
			targetId = data.id;
			data = data.value;
		}

		const myId = this.getAttribute("id");
		if (targetId && targetId !== myId) return;

		if (!data) return;

		const { score, maxAttempts } = data;

		const scoreField = this.querySelector("#score-field");
		if(scoreField) scoreField.textContent = `${Math.round(score*100)}%`;

		const maxAttemptsField = this.querySelector("#max-attempts-field");
		if(maxAttemptsField) maxAttemptsField.textContent = maxAttempts;

		const resultsDiv = this.querySelector("#results");
		if(resultsDiv) resultsDiv.style.display = "block";
	}

	renderForm(questions, savedAnswers) {
		// Clear previous content
		this.innerHTML = "";

		// Create form
		const form = document.createElement("div");
		form.className = "quiz-container";

		// Check if anti-cheat is currently active on this specific quiz
		const AntiCheatActive = !this.options.includes("disable-anticheat");
		console.debug("Options: ");
		console.debug(this.options);

		// Disables and checks for copy+paste / right click / text selection
		if (AntiCheatActive) {
			const logSuspicious = (e, actionName) => {
				// Exception: Allow students to highlight text INSIDE their short-answer boxes to edit typos
				if (e.target.tagName === "INPUT" && e.type === "selectstart") return;

				// Block the default browser action
				e.preventDefault();

				// Log the attempt
				this.send("SUSPICIOUS_ACTION", actionName);
			};

			// Attach the traps to the form
			form.addEventListener("contextmenu", (e) => logSuspicious(e, "right-click"));
			form.addEventListener("copy", (e) => logSuspicious(e, "copy-attempt"));
			form.addEventListener("paste", (e) => logSuspicious(e, "paste-attempt"));
			form.addEventListener("selectstart", (e) => logSuspicious(e, "text-highlight"));
			form.addEventListener("dragstart", (e) => logSuspicious(e, "text-drag-attempt"));
			form.addEventListener("beforeprint", (e) => logSuspicious(e, "print-attempt"));
		}

		// Create hidden results text
		const results = document.createElement("h2");
		results.innerHTML = "Score: <span id='score-field'></span>. Attempts left: <span id='max-attempts-field'></span>";
		results.style.display = "none";
		results.id = "results";
		form.appendChild(results);

		// Render questions
		questions.forEach((q, index) => {
			const qDiv = document.createElement("fieldset");
			qDiv.className = `question-block ${index % 2 === 0 ? "even" : "odd"}`;
			qDiv.style.border = "none";
			qDiv.style.padding = "0";
			qDiv.style.margin = "0 0 30px 0";

			let ttsButtonHTML = "";
			let scriptToRead = "";

			// Only build the script and the button HTML if anti-cheat prevents screen readers
			if (AntiCheatActive) {
				scriptToRead = `Question ${index + 1}. ${q.text}. `;
				if (q.type === "short-answer") {
					scriptToRead += "Please type your answer in the text box.";
				} else if (q.possibleAnswers) {
					scriptToRead += "The options are: ";
					q.possibleAnswers.forEach((ans, i) => {
						scriptToRead += `Option ${i + 1}: ${ans}. `;
					});
				}

				ttsButtonHTML = `
					<button type="button" class="tts-btn" aria-label="Read question aloud" title="Read Aloud" style="background: transparent; border: none; cursor: pointer; color: var(--brand); flex-shrink: 0; padding: 2px; border-radius: 50%;">
					<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
					</button>
				`;
			}

			// Inject the Legend (The TTS button will just be blank if anti-cheat is off)
			const legendText = `${index + 1}. ${q.text}`;
			qDiv.innerHTML = `
				<legend style="font-size: 1.3rem; font-weight: bold; margin-bottom: 15px; line-height: 1.4; width: 100%; display: flex; align-items: flex-start; gap: 10px;">
					${ttsButtonHTML}
					<span>${legendText}</span>
				</legend>
			`;

			// Only attach the event listener if the button was actually created
			if (AntiCheatActive) {
				const ttsBtn = qDiv.querySelector(".tts-btn");
				ttsBtn.addEventListener("click", (e) => {
					e.preventDefault();
					this.speak(scriptToRead);
				});
			}

			// Add interaction logging to quiz elements
			const logInteraction = () => {
				let values = [];
				if (q.type === "short-answer"){
					const el = this.querySelector(`input[name="${q.id}"]`);
					if (el && el.value.trim() !== "") values = [el.value.trim()];
				} else {
					const checked = this.querySelectorAll(`input[name="${q.id}"]:checked`);
					values = Array.from(checked).map(cb => cb.value);
				}

				this.send("QUESTION_ANSWERED", {
					questionID: q.id,
					answer: values.join(" | "), // Join arrays cleanly for the CSV log
				});
			};

			if (q.type === "short-answer") {
				const input = document.createElement("input");
				input.type = "text";
				input.name = q.id;
				input.id = `${q.id}_text`;
				input.style.width = "100%";
				input.style.padding = "5px";
				input.setAttribute("aria-label", `Answer for question: ${q.text}`);

				// Restore saved state (savedAnswers[q.id] is an array of length 1)
				if (savedAnswers[q.id] && savedAnswers[q.id].length > 0) {
					input.value = savedAnswers[q.id][0];
				}

				// Add listener for changes in the text box
				input.addEventListener("change", logInteraction);

				qDiv.appendChild(input);
			} else {

				// Create a shallow copy so we don't permanently alter the original JSON data
				const choices = [...q.possibleAnswers];

				// Standard Fisher-Yates Shuffle (Skip if disabled in JSON)
				if (!this.options.includes("disable-shuffle")) {
					for (let i = choices.length - 1; i > 0; i--) {
						const j = Math.floor(Math.random() * (i + 1));
						[choices[i], choices[j]] = [choices[j], choices[i]];
					}
				}

				choices.forEach((choice, i) => {
					const label = document.createElement("label");
					label.className = "answer-row";

					const input = document.createElement("input");
					input.type = (q.type === "select-all-that-apply") ? "checkbox" : "radio";
					input.value = choice;
					input.name = q.id;
					input.id = `${q.id}_${i}`;

					// Restore saved state
					if (savedAnswers[q.id] && savedAnswers[q.id].includes(choice)) {
						input.checked = true;
					}

					// Listen for answers
					input.addEventListener("change", logInteraction);

					label.appendChild(input);
					label.appendChild(document.createTextNode(" " + choice));
					qDiv.appendChild(label);
					qDiv.appendChild(document.createElement("br"));
				});
			}

			// Evaluate correctness if the user has attempted the quiz at least once
			if (this.hasAttempted) {
				const normalize = arr => (arr || []).map(s => String(s).toLowerCase().trim());
				const correctNorm = normalize(q.correctAnswers);
				const userNorm = normalize(savedAnswers[q.id] || []);

				let isCorrect = false;
				if (q.type === "short-answer") {
					isCorrect = (userNorm.length === 1 && correctNorm.includes(userNorm[0]));
				} else {
					const cSort = [...correctNorm].sort();
					const uSort = [...userNorm].sort();
					isCorrect = (cSort.length === uSort.length && cSort.every((v, i) => v === uSort[i]));
				}

				// Option: show-wrong
				if (this.options.includes("show-wrong")) {
					const feedbackDiv = document.createElement("div");
					feedbackDiv.style.marginTop = "8px";
					feedbackDiv.style.fontWeight = "bold";
					feedbackDiv.style.fontSize = "0.95em";

					if (isCorrect) {
						// Using aria-hidden prevents screen readers from redundantly reading the emoji
						feedbackDiv.innerHTML = `<span aria-hidden="true">✅</span> Correct`;
						feedbackDiv.style.color = "#0f5132"; // WCAG AAA Accessible Dark Green
					} else {
						feedbackDiv.innerHTML = `<span aria-hidden="true">❌</span> Incorrect`;
						feedbackDiv.style.color = "#842029"; // WCAG AAA Accessible Dark Red
					}
					qDiv.appendChild(feedbackDiv);
				}
			}

			// Option: show-answer (Only triggers when out of attempts)
			if (this.attemptsLeft <= 0 && this.options.includes("show-answer")) {
				const answerDiv = document.createElement("div");
				answerDiv.style.marginTop = "8px";
				answerDiv.style.padding = "8px";
				answerDiv.style.backgroundColor = "#e2e3e5"; // Neutral gray background
				answerDiv.style.borderLeft = "4px solid #6c757d";
				answerDiv.innerHTML = `<strong>Correct Answer:</strong> ${q.correctAnswers.join(", ")}`;
				qDiv.appendChild(answerDiv);
			}

			form.appendChild(qDiv);
		});

		// Submit Button
		const btn = document.createElement("button");
		btn.textContent = "Submit Answers";
		btn.className = "btn-submit";
		btn.onclick = () => this.submit(questions);

		form.appendChild(document.createElement("br"));
		form.appendChild(btn);

		this.appendChild(form);
		if (this.attemptsLeft <= 0) {
			btn.disabled = true;
			const score = this.maxScore ? Math.round((this.score/this.maxScore)*100) : "";
			btn.textContent = `No Attempts Left - Score ${score}`;
			// Disable ALL inputs (text, radio, and checkboxes)
			this.querySelectorAll("input").forEach(el => el.disabled = true);
		} else if (this.hasAttempted) {
			btn.textContent = "Resubmit";
		}
	}

	submit(questions) {
		const answers = {};
		this.score = 0;
		this.maxScore = 0;
		this.attemptsLeft--;

		questions.forEach(q => {
			let values = [];

			if (q.type === "short-answer") {
				const input = this.querySelector(`input[name="${q.id}"]`);
				// Grab text if it's not empty and put it in an array
				if (input && input.value.trim() !== "") {
					values = [input.value.trim()];
				}
			} else {
				const checked = this.querySelectorAll(`input[name="${q.id}"]:checked`);
				values = Array.from(checked).map(cb => cb.value);
			}

			answers[q.id] = values;

			// Normalize lowercases everything for easy comparison
			const normalize = arr => (arr || []).map(s => String(s).toLowerCase());
			const correct = normalize(q.correctAnswers);
			const user = normalize(values);

			if (q.type === "short-answer") {
				// For short answer, if their 1 typed string exists the list of acceptable answers
				if (user.length === 1 && correct.includes(user[0])) {
					this.score += q.pointValue;
				}
			} else {
				// For multiple choice / select all, require an exact array match
				// We sort them so ["A", "B"] matches ["B", "A"]
				correct.sort();
				user.sort();
				if (correct.length === user.length && correct.every((v, i) => v === user[i])) {
					this.score += q.pointValue;
				}
			}

			this.maxScore += q.pointValue;
		});

		// UI Updates
		const scoreField = this.querySelector("#score-field");
		if(scoreField) scoreField.textContent = `${Math.round((this.score/this.maxScore)*100)}%`;
		const resultsDiv = this.querySelector("#results");
		if(resultsDiv) resultsDiv.style.display = "block";

		// Disable button
		const btn = this.querySelector(".btn-submit");
		if(btn) { btn.disabled = true; btn.textContent = "Submitted"; }

		// Send RESULT
		this.send("QUIZ_RESULT", {
			score: this.score,
			maxScore: this.maxScore,
			answers: answers,
		});
	}
}

// Register the custom tags
customElements.define("course-video", CourseVideo);
customElements.define("course-article", CourseArticle);
customElements.define("course-quiz", CourseQuiz);
