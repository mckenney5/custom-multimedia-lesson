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
		// Browser calls this when element is added to DOM
		if (!this.rendered) {
			this.render();
			this.attachListeners();

			// Listen for student data updates automatically
			this._boundDataHandler = this.handleStudentData.bind(this);
			window.addEventListener("student-data", this._boundDataHandler);

			this.rendered = true;
		}
	}

	disconnectedCallback() {
		// Browser calls this when element is removed
		// Good place to stop timers or remove global listeners
		// Cleanup listener
		if(this._boundDataHandler){
			window.removeEventListener("student-data", this._boundDataHandler);
		}
	}

	// --- HELPER METHODS ---

	/**
	 * Safe wrapper to send data to the Parent
	 * @param {string} type - Event ID (e.g., "VIDEO_PLAY")
	 * @param {any} message - The data payload
	 */

	requestStudentData() {
		this.send("GET_STUDENT_DATA", "");
	}

	handleStudentData(event) {
		const data = event.detail; // { name: "...", grade: "..." }
		// Default behavior: Do nothing.
		// Child classes (like CourseQuiz) will override this.
		console.log(`[${this.tagName}] Received data for ${data.name}`);
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
		this.seek = 5; // How far FF and RW move the video

		// We use Light DOM, so we write directly to this.innerHTML
		this.innerHTML = `
		<style>
			/* --- DEFAULT LAYOUT (Normal Page Flow) --- */
			#video-container {
				position: relative;
				background-color: #000;
				display: flex;
				flex-direction: column;
				width: 60%;
				max-width: 100%;
				/* Prevent text selection on double clicks */
				user-select: none;
			}

			#vid-player {
				width: 100%;
				display: block;
				/* Ensure video takes available space */
				flex-grow: 1;
			}

			#video-controls {
				/* Default: Sit below the video */
				position: static;
				background-color: #222;
				padding: 10px;
				display: flex;
				justify-content: space-around;
				align-items: center;
				color: white;
				width: 100%;
				box-sizing: border-box;
				z-index: 20; /* Always on top of triggers */
				transition: opacity 0.3s ease; /* Smooth fade */
			}

			/* --- FULL SCREEN OVERRIDES --- */

			/* When the container is in full screen... */
			#video-container:fullscreen {
				justify-content: center; /* Center video vertically */
				background: black;
			}

			/* Make controls float over the video at the bottom */
			#video-container:fullscreen #video-controls {
				position: absolute;
				bottom: 0;
				left: 0;
				width: 100%;
				background-color: rgba(0, 0, 0, 0.7); /* Semi-transparent */
				opacity: 0; /* Hidden by default */
			}

			/* The Trigger Zone (Bottom 15% of screen) */
			#fs-hover-trigger {
				display: none; /* Hidden normally */
			}
			#video-container:fullscreen #fs-hover-trigger {
				display: block;
				position: absolute;
				bottom: 0;
				left: 0;
				width: 100%;
				height: 15%; /* Active area */
				z-index: 10; /* Above video, below controls */
			}

			/* Show controls when hovering the Trigger OR the Controls themselves */
			#video-container:fullscreen #fs-hover-trigger:hover ~ #video-controls,
			#video-container:fullscreen #video-controls:hover {
				opacity: 1;
			}


			/* --- BUTTON STYLES --- */
			#video-controls button {
				background: transparent;
				border: none;
				color: white;
				cursor: pointer;
				font-size: 16px;
				padding: 5px 10px;
				transition: background 0.2s;
			}
			#video-controls button:hover {
				background: rgba(255,255,255,0.2);
				border-radius: 4px;
			}
			#speed-slider { margin: 0 10px; cursor: pointer; }
		</style>

		<div id="video-container">
			<div id="fs-hover-trigger"></div>

			<div id="loading-overlay" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); color: white; align-items: center; justify-content: center; z-index: 10; pointer-events: none; font-size: 1.2rem;">
				<span class="spinner">⏳ Buffering...</span>
			</div>

			<h3 id="muted" style="color: red; position: absolute; top: 10px; left: 10px; z-index: 5; margin: 0;"></h3>

			<video id="vid-player" src="${src}" poster="${poster}"></video>

			<div id="video-controls">
				<button id="play-pause" type="button">Play</button>
				<button id="rewind" type="button">-5s</button>
				<button id="forward" type="button">+5s</button>

				<span id="time-display" style="font-family: monospace; font-variant-numeric: tabular-nums; min-width: 12ch; text-align: center;">0:00 / 0:00</span>

				<label for="speed-slider">Speed:</label>
				<input type="range" id="speed-slider" min="0.5" max="2.0" step="0.1" value="1">
				<span id="speed-value" style="display: inline-block; width: 3ch;">1x</span>

				<button id="full-screen" type="button">Full Screen</button>
			</div>
		</div>
		`;

		// Cache references to elements so we don't querySelector every time
		this.videoElem = this.querySelector("#vid-player");
		this.playBtn = this.querySelector("#play-pause");
		this.seekSlider = this.querySelector("#slider-seek");
		this.timeDisplay = this.querySelector("#time-display");
		this.rewindButton = this.querySelector("#rewind");
		this.forwardButton = this.querySelector("#forward");
		this.speedSlider = this.querySelector("#speed-slider");
		this.speedSliderSpan = this.querySelector("#speed-value");
		this.fullScreenButton = this.querySelector("#full-screen");
		this.videoContainer = this.querySelector("#video-container");
		this.muteBanner = this.querySelector("#muted");
		this.loadingOverlay = this.querySelector("#loading-overlay");

		// State tracking
		this.lastLoggedPercent = 0;
	}

	attachListeners() {

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
				this.playBtn.textContent = "Pause";
				this.send("VIDEO_PLAYING", this.videoElem.currentTime);
			} else {
				this.videoElem.pause();
				this.playBtn.textContent = "Play";
				this.send("VIDEO_PAUSED", this.videoElem.currentTime);
			}
		});



		this.rewindButton.addEventListener("click", () => {
			this.videoElem.pause();
			this.send("VIDEO_REWIND", this.videoElem.currentTime);
			this.videoElem.currentTime -= this.seek;
			this.videoElem.play();
		});

		this.forwardButton.addEventListener("click", () => {
			this.videoElem.pause();
			this.send("VIDEO_FORWARD", this.videoElem.currentTime);
			this.videoElem.currentTime += this.seek;
			this.videoElem.play();
		});

		this.speedSlider.addEventListener("input", () => {
			this.speedSliderSpan.textContent = this.speedSlider.value + "x";
		});

		this.speedSlider.addEventListener("change", () => {
			this.send("VIDEO_SPEED_CHANGE", `from ${this.videoElem.playbackRate} to ${this.speedSlider.value}`);
			this.videoElem.playbackRate = this.speedSlider.value;
		});

		this.fullScreenButton.addEventListener("click", () => {
			// Toggle full screen
			!document.fullscreenElement ? this.videoContainer.requestFullscreen() : document.exitFullscreen();
		});

		this.videoContainer.addEventListener("fullscreenchange", () => {
			if (!document.fullscreenElement) {
				this.send("VIDEO_NORMAL_SCREEN", "");
				this.fullScreenButton.textContent = "Full Screen";
			} else {
				this.send("VIDEO_FULL_SCREEN", "");
				this.fullScreenButton.textContent = "Normal Screen";
			}
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
					this.videoElem.muted = !this.videoElem.muted;
					this.send("VIDEO_MUTED", "");
					this.muteBanner.innerHTML = this.videoElem.muted ? "Video Muted" : "";
					break;
			}
		});

		// Progress Tracking
		this.videoElem.addEventListener("timeupdate", () => {
			const currentTime = this.videoElem.currentTime;
			const duration = this.videoElem.duration || 0; // Handle NaN if loading

			const pct = (currentTime / duration);

			// Update UI with "Current / Total"
			this.timeDisplay.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;

			// Send to Parent
			this.send("VIDEO_PROGRESS", pct);
		});

		// Completion
		this.videoElem.addEventListener("ended", () => {
			this.playBtn.textContent = "Replay";
			this.send("VIDEO_PROGRESS", 1.0); // Ensure 100% is sent
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
			this._handleStudentData = this.handleStudentData.bind(this);
			window.addEventListener("student-data", this._handleStudentData);
			this.requestStudentData();
		}
	}

	handleStudentData(event) {
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
		// 1. Bind the scroll function so we can remove it cleanly later
		this._onScroll = this.checkScroll.bind(this);

		// 2. Attach to Window (Global scroll)
		window.addEventListener("scroll", this._onScroll);

		// 3. Check immediately (In case the text is short and fits on one screen)
		this.checkScroll();
	}

	checkScroll() {
		// Standard "Am I at the bottom?" math
		// We add a tiny buffer (10px) to handle browser zoom/rounding errors
		if(document.body.scrollHeight === 0) return; //HACK

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
		window.removeEventListener("scroll", this._onScroll);
		window.removeEventListener("student-data", this._handleStudentData);
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

		// Create hidden results text
		const results = document.createElement("h2");
		results.innerHTML = "Score: <span id='score-field'></span>. Attempts left: <span id='max-attempts-field'></span>";
		results.style.display = "none";
		results.id = "results";
		form.appendChild(results);

		// Render questions
		questions.forEach((q, index) => {
			const qDiv = document.createElement("div");
			qDiv.className = `question-block ${index % 2 === 0 ? "even" : "odd"}`;
			qDiv.innerHTML = `<h3>${index + 1}. ${q.text}</h3>`;

			// Add interaction logging to quiz elements
			const logInteraction = () => {
				let values = [];
				if (q.type === "short-answer") {
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

				// Restore saved state (savedAnswers[q.id] is an array of length 1)
				if (savedAnswers[q.id] && savedAnswers[q.id].length > 0) {
					input.value = savedAnswers[q.id][0];
				}

				// Add listener for changes in the text box
				input.addEventListener("change", logInteraction);

				qDiv.appendChild(input);
			} else {
				q.possibleAnswers.forEach((choice, i) => {
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
			const btn = this.querySelector(".btn-submit");
			if(btn) {
				btn.disabled = true;
				const score = this.maxScore ? Math.round((this.score/this.maxScore)*100) : "";
				btn.textContent = `No Attempts Left - Score ${score}`;
			}
			// Disable ALL inputs (text, radio, and checkboxes)
			this.querySelectorAll("input").forEach(el => el.disabled = true);
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
