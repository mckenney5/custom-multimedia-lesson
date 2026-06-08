// eslint-disable-next-line no-var
var debugging = new URLSearchParams(window.location.search).get("debug") === "true";
let state = {
	// --- Properties (Data) ---
	data: {
		pages: [],
		delta: {
			// Saved data that changes over time
			// This schema must be in this order for reference with saving
			currentPageIndex: 0,
			progress: 0, // Sets the furthest we have been
			totalCourseSeconds: 0,
			pagesState: [], // <-- watchTime, score, videoProgress, scrolled, completed, userAnswers
		},
		courseRules: {}, // Holds overall course rules like miniumum time, passing grade or just 'mark complete'

		log: [],
	},
	// --

	lessonFrame: null,	 // Will hold the iframe element
	pauseSave: false, // Flag to pause the save on a reset
	test: null, // Used for debugging
	studentName: "",
	studentID: "",
	sessionStartTime: 0, // Logs how long the student has been on today
	isIdle: false, // Tracks if the user is idle on the site to help balance logs
	focusTimer: null, // handles timing between focus checks
	pageAPISecret: null,
	currentTheme: "light",
	initialized: false,

	init: async function(frameId) {
		// Set up LMS connection
		if(!lms.initialized) lms.init();

		// Set the student's name
		this.studentName = lms.getStudentName().split(",")[1] || ""; // returns first name (Lastname,Firstname)

		// Set the student's ID
		this.studentID = lms.getStudentID();

		// Set up journaler and give it access to the alert and lockdown features for critical events (like possible data corruption)
		if(!journaler.initialized) await journaler.init((msg) => confirm(msg), this.lockDown.bind(this));

		// Set up UI module
		ui.init();

		// Wire UI callbacks
		ui._currentTheme = "light";
		ui._onRefresh = async () => {
			try { await this.save(); } catch(e) { console.error("Refresh save error", e); }
			window.location.reload();
		};
		ui._onReset = () => this.reset();
		ui._onThemeChange = (value) => {
			this.setTheme(value);
			ui._currentTheme = value;
		};
		ui._onPrint = () => ui.printCertificate();

		// Set the date and time of us starting today. TODO consider not using the user for time
		this.sessionStartTime = Date.now();

		// Finds the required iframe
		this.lessonFrame = document.getElementById(frameId);

		// Attempt to load the course (static data)
		await this.loadCourseData();

		// Attempt to load the saved state
		await this.loadSave();

		// Set up API Secret for the pages (auth)
		this.pageAPISecret = utils.generatePasscode();

		// Set up nonce replay protection
		if(this._noncePruneTimer){
			clearInterval(this._noncePruneTimer);
		}
		this._seenNonces = new Map();
		this._noncePruneTimer = setInterval(() => {
			const cutoff = Date.now() - 300000;
			for(const [nonce, ts] of this._seenNonces){
				if(ts < cutoff) this._seenNonces.delete(nonce);
			}
		}, 60000);

		// Load last webpage we were on
		this.lessonFrame.src = this.data.pages[this.data.delta.currentPageIndex].path;

		// Start event listeners and timers
		this.startEventListeners();

		// Update the UI bar
		ui.updateInfo({
			currentPageIndex: this.data.delta.currentPageIndex,
			pageCount: this.data.pages.length,
			progress: this.data.delta.progress,
		});

		// Cache page data for help modal
		ui._lastPage = this.data.pages[this.data.delta.currentPageIndex];
		ui._lastPageDelta = this.data.delta.pagesState[this.data.delta.currentPageIndex];

		// Mark done
		this.initialized = true;
	},

	startEventListeners: function(){

		// Add the Esc key as a shortcut to closing the info banner
		const handleShortcuts = (e) => {
			if (e.key === "Escape" || e.code === "Escape") {
				// Check if Help Modal is open
				if (ui.helpOverlay && ui.helpOverlay.style.display === "flex") {
					e.preventDefault();
					ui.closeHelp(this.lessonFrame);
				} else if (ui.isBannerVisible()) {
					// Check if banner visible
					e.preventDefault();
					ui.hideBanner();
				}
				// If not visible and not in help, do nothing
			}

			if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
				return;
			}

			// PageDown = Next Page
			if (e.key === "PageDown") {
				e.preventDefault();
				this.next();
			}

			// PageUp = Previous Page
			if (e.key === "PageUp") {
				e.preventDefault();
				this.prev();
			}

		};

		// Attach to parent window
		window.addEventListener("keydown", handleShortcuts);

		// turn on visibility tracking
		document.addEventListener("visibilitychange", () => {
			const type = document.hidden ?  "VISIBILITY_HIDDEN" : "VISIBILITY_VISIBLE";
			journaler.log(type, this.data.delta.currentPageIndex);
		});

		// create focus and blur function for both parent and iframe
		const onFocus = () => {
			if(this.focusTimer){
				clearTimeout(this.focusTimer);
				this.focusTimer = null;
			}

			if(this.isIdle){
				this.isIdle = false;
				journaler.log("CLICK_BACK", this.data.delta.currentPageIndex);
			}
		};

		const onBlur = () => {
			if (ui.isPaused) return; // Disabled when looking at help menu
			this.focusTimer = setTimeout(() => {
				if(!this.isIdle){
					this.isIdle = true;
					journaler.log("CLICK_OFF", this.data.delta.currentPageIndex);
				}
			}, 100);
		};

		// assign the focus and blur to parent if possible
		window.addEventListener("focus", onFocus);
		window.addEventListener("blur", onBlur);

		// assign the focus and blur to iframe if allowed
		this.lessonFrame.addEventListener("load", () => {
			try {
				this.setTheme(this.currentTheme); // Set the theme on each page turn
				const childWindow = this.lessonFrame.contentWindow;
				childWindow.addEventListener("focus", onFocus);
				childWindow.addEventListener("blur", onBlur);
				childWindow.document.addEventListener("click", onFocus);
				childWindow.addEventListener("keydown", handleShortcuts); // For info banner

				// assign the focus and blur to parent if possible
				// browsers will ignore repeat identical event listeners
				window.addEventListener("focus", onFocus);
				window.addEventListener("blur", onBlur);
			} catch (e) {
				console.warn(`state.startEventListeners: Unable to add focus/blur --> ${e}`);
				journaler.log("GENERAL", "focus/blur events disabled");
				window.removeEventListener("focus", onFocus);
				window.removeEventListener("blur", onBlur);
			}
		});

		// track the time in the course and the current page
		setInterval(() => {
			if (ui.isPaused) return; // Disabled when looking at help menu
			if(++this.data.delta.totalCourseSeconds % 60 == 0){
				if(!debugging) this.save();
			}
			const page = this.data.delta.pagesState[this.data.delta.currentPageIndex];
			page.watchTime += 1;

			// Handles checking if student was idle after page was complete for 5min
			// Timer resets on refresh
			if (page.completed) {
				// Initialize a new counter if it doesn't exist yet
				page.idleTime = (page.idleTime || 0) + 1;

				// Fire exactly once after 5 minutes (300 seconds) of ignoring the next button
				if (page.idleTime === 300) {
					journaler.log("PAGE_IDLE", this.data.delta.currentPageIndex);
				}
			}

			this.finalizePage();

		}, 1000);

	},

	serialize: function(){
		const delta = this.data.delta;
		const data = [
			delta.currentPageIndex,
			delta.progress,
			delta.totalCourseSeconds,
		];

		delta.pagesState.slice().forEach(p => {
			const roundFloatTo2Int = n => Math.round(n*100);

			// Standard Metrics
			data.push(p.completed ? 1: 0);
			data.push(p.scrolled ? 1: 0);
			data.push(roundFloatTo2Int(p.score));
			data.push(p.watchTime);
			data.push(p.attempts);
			data.push(roundFloatTo2Int(p.videoProgress));

			// Complex State: Determine what to save
			let complexState = {};
			if (p.components && Object.keys(p.components).length > 0) {
				complexState = p.components;
			} else {
				complexState = { userAnswers: p.userAnswers };
			}

			// Stringify and Sanitize
			data.push(journaler.sanitize(JSON.stringify(complexState)));
		});

		return data;
	},

	deserialize: function(arr){
		const delta = this.data.delta;
		const GLOBALS_COUNT = 3;
		const ITEMS_PER_PAGE = 7; // 6 numbers + 1 JSON string

		// Restore Globals
		if(arr.length >= 3) {
			delta.currentPageIndex = arr[0];
			delta.progress = arr[1];
			delta.totalCourseSeconds = arr[2];
		}

		// Restore Pages
		delta.pagesState = delta.pagesState.map((p, i) => {
			const base = GLOBALS_COUNT + (i * ITEMS_PER_PAGE);
			if(base >= arr.length) return p;

			// Restore standard metrics
			p.completed = (arr[base + 0] === 1);
			p.scrolled = (arr[base + 1] === 1);
			p.score = arr[base + 2]/100;
			p.watchTime = arr[base + 3];
			p.attempts = arr[base + 4];
			p.videoProgress = arr[base + 5]/100;

			// Restore Complex State
			try {
				const savedBlob = JSON.parse(arr[base + 6] || "{}");
				p.components = { ...p.components, ...savedBlob };
			} catch (e) {
				console.warn("Failed to deserialize page state blob", e);
			}

			return p;
		});
	},

	handleLastPage: function(){
		completion.finalizeCourse(this.data.courseRules, this.data.delta.totalCourseSeconds, this.data.pages, this.data.delta.pagesState);
		if(!completion.checkCourseCompletion(this.data.courseRules, this.data.delta.totalCourseSeconds, this.data.pages, this.data.delta.pagesState)) return false;

		// Calculate score and log
		const grade = completion.calculateOverallGrade(this.data.pages, this.data.delta.pagesState);
		const gradeString = String(Math.round(grade.ratio * 100));
		journaler.log("COURSE_COMPLETE", gradeString);
		journaler.transmit("FINAL", journaler.report().join("\n"), true);

		lms.setScore(grade.earnedScore, grade.maxScore);

		const minimumGrade = this.data.courseRules.minimumGrade;
		const completeOnly = this.data.courseRules.completeOnly;
		const studentsCanFail = this.data.courseRules.studentsCanFail;

		let hasPassed = true;

		if(completeOnly){
			lms.setStatus("completed");
		} else if(studentsCanFail){
			if(grade.ratio < minimumGrade){
				lms.setStatus("failed");
				hasPassed = false;
			} else {
				lms.setStatus("passed");
			}
		} else {
			// If they can't fail, but didn't meet the score, we treat it as a fail/retry state
			hasPassed = grade.ratio >= minimumGrade;
		}

		// Show final screen
		ui.showEndScreen(hasPassed, gradeString, String(Math.round(minimumGrade * 100)), {
			onQuit: () => this.quit(),
			onPrint: () => ui.printCertificate(),
			printData: {
				studentName: this.studentName,
				overallGrade: completion.calculateOverallGrade(this.data.pages, this.data.delta.pagesState),
				totalSeconds: this.data.delta.totalCourseSeconds,
				certConfig: this.data.courseRules.certificate || {},
				minimumMinutes: this.data.courseRules.minimumMinutes,
			},
		});
		return true;
	},

	finalizePage: function(){
		const page = this.data.pages[this.data.delta.currentPageIndex];
		const pageDelta = this.data.delta.pagesState[this.data.delta.currentPageIndex];
		if(completion.checkIfComplete(page, pageDelta) && this.data.delta.currentPageIndex === this.data.delta.progress && pageDelta.completed === false){
			pageDelta.completed = true;
			this.data.delta.progress += 1;
			journaler.log("GENERAL", `Page ${this.data.delta.currentPageIndex} completed`);
			journaler.log("PAGE_COMPLETE", this.data.delta.currentPageIndex);
			ui.bannerMessage("This page is completed. You may continue", false);
			this.save();
		} else {
			return false;
		}
		return false;
	},

	advancePage: function(){
		// Goes to the next page
		const lastPage = this.data.pages.length - 1;
		const currentPage = this.data.delta.currentPageIndex;

		if(currentPage === lastPage){
			// If we are on the final page, try to finish the course
			completion.finalizeCourse(this.data.courseRules, this.data.delta.totalCourseSeconds, this.data.pages, this.data.delta.pagesState);
			if(completion.checkCourseCompletion(this.data.courseRules, this.data.delta.totalCourseSeconds, this.data.pages, this.data.delta.pagesState)){
				this.handleLastPage();
			} else {
				ui.bannerMessage("You have not finished all course requirements. Review your work and try again.");
			}
		} else {
			// Just go to the next page
			this.data.delta.currentPageIndex += 1;
			journaler.log("PAGE_NEXT", this.data.delta.currentPageIndex);
			this.lessonFrame.src = this.data.pages[this.data.delta.currentPageIndex].path;
		}
	},

	next: function() {
		if(this.initialized === false){
			console.error("Cannot go to next page until the state is initialized. Run state.init() first");
			return false;
		}
		ui.hideBanner(); //reset banner

		const page = this.data.pages[this.data.delta.currentPageIndex];
		const pageDelta = this.data.delta.pagesState[this.data.delta.currentPageIndex];

		if(completion.checkIfComplete(page, pageDelta) && !pageDelta.completed){
			// if we just completed the page
			pageDelta.completed = true;
			journaler.log("GENERAL", `Page ${this.data.delta.currentPageIndex} completed`);
			this.advancePage();
		} else if(pageDelta.completed) {
			//if we are on a completed page
			// see if we can go next
			this.advancePage();
		} else {
			// if we did not complete the page
			ui.bannerMessage("You must complete the current page to continue");
			journaler.log("ADVANCE_DENIED", this.data.delta.currentPageIndex);
		}
		ui.updateInfo({
			currentPageIndex: this.data.delta.currentPageIndex,
			pageCount: this.data.pages.length,
			progress: this.data.delta.progress,
		});

		const idx = this.data.delta.currentPageIndex;
		ui._lastPage = this.data.pages[idx];
		ui._lastPageDelta = this.data.delta.pagesState[idx];
	},

	prev: function() {
	// Tries to go back a page
		if (!this.lessonFrame || !ui.infoBanner) {
			console.error("State not initialized. Call state.init() first.");
			return;
		}

		// Hide any old errors
		ui.hideBanner();

		// Deccrement index
		this.data.delta.currentPageIndex--;

		// Check if we are at the end
		if (this.data.delta.currentPageIndex < 0) {
			ui.bannerMessage("Cannot go back. You are on the first page");
			this.data.delta.currentPageIndex = 0;
			return;
		}

		// Log the navigation event
		journaler.log("PAGE_PREV", this.data.delta.currentPageIndex);

		// Set the iframe source
		this.lessonFrame.src = this.data.pages[this.data.delta.currentPageIndex].path;
		ui.updateInfo({
			currentPageIndex: this.data.delta.currentPageIndex,
			pageCount: this.data.pages.length,
			progress: this.data.delta.progress,
		});

		const idx = this.data.delta.currentPageIndex;
		ui._lastPage = this.data.pages[idx];
		ui._lastPageDelta = this.data.delta.pagesState[idx];
	},

	save: async function(){
	// saves the state to the local browser storage
		if(this.pauseSave){ console.debug("Ignoring Save"); return;}

		const saveData = this.serialize();

		const compressed = await journaler.pack(saveData);

		// Try to save with the LMS
		if(compressed){
			lms.saveData(compressed);
			const progress = Math.round((this.data.delta.progress/Math.max(1, this.data.pages.length-1))*100);
			journaler.transmit("PROGRESS", `${progress}%\n${compressed}`, false); // <-- send progress log, low priority
		} else {
			console.error(`state.save: unable to save to save the data '${saveData}'. Compressed returned '${compressed}'`);
		}

	},

	loadSave: async function(){
	// loads the state from the local browser
		// Try to load from the LMS first
		const data = await journaler.unpack(lms.loadData());

		// If that fails, try local backup
		/*if(!stateAsString){
			stateAsString = localStorage.getItem("courseProgress");
		}*/

		if(data) {
			// If data is there, try to load it
			try {
				this.deserialize(data.delta);
			} catch(e) {
				console.error(`state.loadSave: Unable to parse saved data: ${e}`);
			}
		} else {
			journaler.log("STARTED_NEW_COURSE", "");
		}
	},

	reset: function(){
	// reset the state
		const confirmed = window.confirm("Are you sure you want to reset all of your progress? This action cannot be undone.");
		if(confirmed){
			this.pauseSave = true;
			console.debug("Resetting progress");
			//localStorage.removeItem("courseProgress");
			lms.reset(); // <-- set the saved data to nothing
			this.lessonFrame.src = this.data.pages[0].path + "?_cb=" + Date.now();
			// TODO check if we are debugging, if so, delete the saved log too
			window.onbeforeunload = null;
			window.location.reload();
		}
	},

	lockDown: function(){
		//Stops saving and disables the course
		this.pauseSave = true;

		// disable buttons
		document.querySelectorAll("button").forEach(btn => btn.disabled = true);

		//clear the screen
		this.lessonFrame.src = "about:blank";

		// quit
		this.quit();

		// Inform the user
		window.document.body.innerHTML = "<h2>Course disabled</h2>";

		// remove event listeners
		window.onbeforeunload = () => "Course disabled. Saving is blocked to prevent data corruption.";
		window.onunload = () => console.debug("Stopping quit");

		// nuke the state and its modules
		window.state = null;
		window.journaler = null;
		window.lms = null;

		// now the user cannot destroy their saved file, unless they refresh!

	},

	quit: function(){
		if(!this.sessionStartTime) return; // <-- if not initialized

		const sessionDuration = Date.now() - this.sessionStartTime;

		lms.setSessionTime(sessionDuration);

		lms.quit();
	},

	sendMessage: function(subject, message){
		this.lessonFrame.contentWindow.postMessage({ type: subject,
			message: message}, window.location.origin);
	},

	handleMessage: function(event){
		//console.debug(event);
		const index = this.data.delta.currentPageIndex;
		const page = this.data.pages[index];
		const pageDelta = this.data.delta.pagesState[this.data.delta.currentPageIndex];
		const name = this.handleMessage.name;
		const roundTo4 = n => Math.round(n*10000)/10000;

		if(event.origin != window.location.origin){
			console.error(`${name}: Unknown message sender! --> ${event}`);
			return;
		}

		if(event.data.type !== "ORIGIN"){
			if(!this.pageAPISecret){
				console.error(`${name}: Message received before handshake complete`);
				return;
			}
			if(event.data.code !== this.pageAPISecret){
				console.error(`${name}: Invalid code --> ${event.data.code}`);
				return;
			}
		}

		// 2. NONCE VALIDATION (skip for ORIGIN which is handshake-only)
		if(event.data.type !== "ORIGIN"){
			const nonce = event.data.nonce;
			const now = Date.now();
			if(typeof nonce !== "number" || now - nonce > 300000 || now - nonce < 0){
				this._rejectNonce(nonce);
				return;
			}
			if(this._seenNonces.has(nonce)){
				this._rejectNonce(nonce);
				return;
			}
			this._seenNonces.set(nonce, now);
		}

		// 3. UNWRAP the message
		let msgData = event.data.message;
		let componentID = null;

		// Check if this is a wrapped packet { id: "...", value: ... }
		if (msgData && typeof msgData === "object" && "id" in msgData && "value" in msgData) {
			componentID = msgData.id; // Extract ID
			msgData = msgData.value;  // Extract actual payload
		}

		// Now use 'componentID' and 'msgData' for the rest of the function

		switch(event.data.type){
			case "ORIGIN":
				// tell the iframe who we are. Trust on First Use (TOFU)
				this.lessonFrame.contentWindow.postMessage({ type: "ORIGIN", message: window.location.origin, code: this.pageAPISecret }, window.location.origin);
				console.debug("Auth Attempt");
				break;

			case "QUIZ_RESULT":
				journaler.log("QUIZ_SUBMITTED", `${index},${componentID},${msgData.score},${msgData.maxScore}`);

				if(componentID && pageDelta.components && pageDelta.components[componentID]){
					const compState = pageDelta.components[componentID];
					const compConfig = page.components.find(c => c.id === componentID);

					// Increment attempts
					compState.attempts = (compState.attempts || 0) + 1;

					compState.score = msgData.score;
					compState.userAnswers = msgData.answers;
					compState.completed = true;

					// Re-sum total page score
					let totalScore = 0;
					for(const key in pageDelta.components){
						// Ensure we handle potential undefined scores safely
						const s = pageDelta.components[key].score;
						if(typeof s === "number") totalScore += s;
					}
					pageDelta.score = totalScore;

					// Send attempt count to quiz
					this.lessonFrame.contentWindow.postMessage({
						type: "QUIZ_DATA",
						message: {
							id: componentID,
							value: {
								questions: compConfig.questions, // (Optional if component caches it)
								userAnswers: compState.userAnswers,
								attemptsLeft: (page.completionRules.attempts || Infinity) - compState.attempts, // <--- The updated count
								options: compConfig.options || [], // Add options to the specific quiz, like "show-wrong"
								hasAttempted: compState.attempts > 0, // Flag to check attempts
							},
						},
					}, window.location.origin);

					this.finalizePage();
				}
				break;

			case "GET_QUIZ_DATA":
				// Composite Logic ---
				if(componentID && page.components){
					console.debug(`comp -->\n${page.components}`);
					const compConfig = page.components.find(c => c.id === componentID);
					const compState = pageDelta.components[componentID];

					if(compConfig && compState){
						const quizPayload = {
							questions: compConfig.questions,
							userAnswers: compState.userAnswers || {},
							attemptsLeft: (page.completionRules.attempts || Infinity) - (compState.attempts || 0),
							options: compConfig.options || [],
							hasAttempted: (compState.attempts || 0) > 0,
						};
						// Send with ID
						this.lessonFrame.contentWindow.postMessage({
							type: "QUIZ_DATA",
							message: {
								id: componentID,        // <--- Match component expectation
								value: quizPayload,     // <--- Match component expectation
							},
						}, window.location.origin);
					}
				}
				journaler.log("QUESTIONS_RENDERED", index);
				break;

			case "QUESTION_ANSWERED":
				// Log format: PageIndex, QuizID, QuestionID, Answer
				journaler.log("QUESTION_ANSWERED", `${index},${componentID},${msgData.questionID},${msgData.answer}`);
				break;

			case "SUSPICIOUS_ACTION":
				// Logs things like copy paste, right click, and text selection
				// Log format: PageIndex, QuizID, ActionType
				journaler.log("SUSPICIOUS_ACTION", `${index},${componentID || "legacy"},${msgData}`);
				break;

			case "LOG":
				journaler.log("GENERAL", `${index} ${msgData}`);
				break;

			case "PAGE_SCROLLED":
				// Simple update: If component sent it, mark component. Always mark page.
				if(componentID && pageDelta.components && pageDelta.components[componentID]){
					pageDelta.components[componentID].scrolled = msgData;
				}
				pageDelta.scrolled = msgData;
				journaler.log("SCROLLED", index);
				break;

			case "VIDEO_PROGRESS":
				// Simple update: If component sent it, mark component. Always mark page.
				if(componentID && pageDelta.components && pageDelta.components[componentID]){
					pageDelta.components[componentID].videoProgress = msgData;
				}
				pageDelta.videoProgress = msgData;

				if(Math.round(msgData * 100) % journaler.videoProgressInterval === 0){
					journaler.log("VIDEO_PROGRESS", `${index},${roundTo4(pageDelta.videoProgress)}`);
				}
				break;

				// ... (Rest of switch statement remains UNCHANGED) ...
			case "VIDEO_PLAYING":
				journaler.log("VIDEO_PLAY", `${index},${roundTo4(pageDelta.videoProgress)}`);
				break;

			case "VIDEO_PAUSED":
				journaler.log("VIDEO_PAUSE", `${index},${roundTo4(pageDelta.videoProgress)}`);
				break;

			case "VIDEO_REWIND":
				journaler.log("VIDEO_REWIND", `${index},${roundTo4(pageDelta.videoProgress)}`);
				break;

			case "VIDEO_FORWARD":
				journaler.log("VIDEO_FORWARD", `${index},${roundTo4(pageDelta.videoProgress)}`);
				break;

			case "VIDEO_SPEED_CHANGE":
				journaler.log("VIDEO_SPEED_CHANGE", `${index},${roundTo4(pageDelta.videoProgress)},${msgData}`);
				break;

			case "VIDEO_FULL_SCREEN":
				journaler.log("VIDEO_FULL_SCREEN", `${index},${roundTo4(pageDelta.videoProgress)}`);
				break;

			case "VIDEO_NORMAL_SCREEN":
				journaler.log("VIDEO_NORMAL_SCREEN", `${index},${roundTo4(pageDelta.videoProgress)}`);
				break;

			case "VIDEO_MUTED":
				journaler.log("VIDEO_MUTED", `${index},${roundTo4(pageDelta.videoProgress)},${msgData}`);
				break;

			case "VIDEO_STATS":
				// Save it to the dynamic state map
				if(componentID && pageDelta.components && pageDelta.components[componentID]){
					pageDelta.components[componentID].avgSpeed = msgData.avgSpeed;
					pageDelta.components[componentID].visiblePct = msgData.visiblePct;
				}

				// Log format: PageIndex, VideoID, AvgSpeed, VisiblePct
				journaler.log("VIDEO_STATS", `${index},${componentID},${msgData.avgSpeed},${msgData.visiblePct}`);
				break;

			case "CODE_EXECUTION":
				journaler.log("CODE_EXEC", `${index},${componentID},score:${msgData.score}/${msgData.maxScore}`);

				if (componentID && pageDelta.components && pageDelta.components[componentID]) {
					const compState = pageDelta.components[componentID];
					compState.codeContent = msgData.code;
					compState.testResults = msgData.testResults;
					compState.score = msgData.score;
					compState.maxScore = msgData.maxScore;
					compState.completed = msgData.completed;
					compState.attempts = (compState.attempts || 0) + 1;

					// Re-sum total page score
					let totalScore = 0;
					for (const key in pageDelta.components) {
						const s = pageDelta.components[key].score;
						if (typeof s === "number") totalScore += s;
					}
					pageDelta.score = totalScore;

					// Send updated state back to component
					this.lessonFrame.contentWindow.postMessage({
						type: "PROGRAMMING_DATA",
						message: {
							id: componentID,
							value: {
								attemptsLeft: (page.completionRules.attempts || Infinity) - (compState.attempts || 0),
								hasAttempted: (compState.attempts || 0) > 0,
								testResults: msgData.testResults,
							},
						},
					}, window.location.origin);
				}
				this.finalizePage();
				break;

			case "GET_PROGRAMMING_DATA":
				if (componentID && page.components) {
					const compConfig = page.components.find(c => c.id === componentID);
					const compState = pageDelta.components[componentID];
					if (compConfig && compState) {
						this.lessonFrame.contentWindow.postMessage({
							type: "PROGRAMMING_DATA",
							message: {
								id: componentID,
								value: {
									starterCode: compConfig.starterCode || "",
									language: compConfig.language || "javascript",
									timeout: compConfig.timeout || 5000,
									expectedOutput: compConfig.expectedOutput,
									testCases: compConfig.testCases || [],
									options: compConfig.options || [],
									savedCode: compState.codeContent,
									testResults: compState.testResults,
									attemptsLeft: (page.completionRules.attempts || Infinity) - (compState.attempts || 0),
									hasAttempted: (compState.attempts || 0) > 0,
								},
							},
						}, window.location.origin);
					}
				}
				break;

			case "GET_STUDENT_DATA":
				const grade = String(Math.floor((completion.calculateOverallGrade(this.data.pages, this.data.delta.pagesState).ratio * 100)));
				this.lessonFrame.contentWindow.postMessage({ type: "GET_STUDENT_DATA", message: {
					name: this.studentName, grade: grade } }, window.location.origin);
				journaler.log("GENERAL", "student info requested, page " + String(index));
				break;

			case "SEND_RENDER":
				console.debug(`${name}: SEND_RENDER not implemented yet`);
				break;

			case "SEND_META":
				const pageInfo = {
					page: page,
					delta: pageDelta,
				};
				this.sendMessage("SEND_META", pageInfo);
				break;

			default:
				console.error(`${name}: Unknown / unimplemented message! --> \n`, event);
				break;
		}
		this.finalizePage();
	},

	_rejectNonce: function(nonce){
		console.error("Invalid or expired nonce -->", nonce);
		if(this.lessonFrame && this.lessonFrame.contentWindow){
			this.lessonFrame.contentWindow.postMessage({
				type: "NONCE_REJECTED",
				nonce: nonce,
			}, window.location.origin);
		}
	},

	loadCourseData: async function(){
		/* Sets up the state of the program
		 * Loads and sets up static data objects
		 * Loads and sets up dynamic data objects
		 */
		try {
			let response = null;
			if(debugging){
				console.debug("Skipping cache for JSON");
				response = await fetch("lessons/course_data.json", {
					cache: "no-store",
				});
			} else {
				response = await fetch("lessons/course_data.json");
			}
			console.debug("Loaded course_data.json");
			const rawData = await response.json();

			this.data.courseRules = rawData.courseRules || {};
			this.data.delta.pagesState = [];

			this.data.pages = rawData.pages.map(page => {

				// 1. Create the State Object
				const pageState = {
					// Flat properties for the Page itself
					completed: false,
					scrolled: false,
					score: 0.0,
					watchTime: 0,
					attempts: 0,
					videoProgress: 0.0,

					// The Future: Component State Map
					components: {},
				};

				let calculatedMaxScore = 0.0;

				// 2. Initialize Components (if present)
				if (page.components && Array.isArray(page.components)) {
					page.components.forEach((comp, index) => {
						if(!comp.id) {
							comp.id = `auto-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
							console.error(`Component on page '${page.name}' missing ID - generated fallback: ${comp.id}`);
						}

						if(!comp.type) {
							console.error(`Component with id '${comp.id}' on page '${page.name}' missing type - skipping`);
							return;
						}

						// Initialize specific state for this component
						const compState = {
							type: comp.type,
							completed: false,
						};

						// Add type-specific defaults
						if (comp.type === "quiz") {
							if (!comp.questions || !Array.isArray(comp.questions)) {
								console.error(`Quiz component '${comp.id}' missing questions array - skipping`);
								return;
							}
							const qMax = comp.questions.reduce((acc, q) => acc + q.pointValue, 0.0);
							calculatedMaxScore += qMax;
							compState.score = 0;
							compState.maxScore = qMax;
							compState.userAnswers = {};
							compState.attempts = 0;
						}
						else if (comp.type === "video") {
							compState.videoProgress = 0.0;
						}
						else if (comp.type === "article") {
							compState.scrolled = false;
						}
						else if (comp.type === "programming") {
							compState.codeContent = comp.starterCode || "";
							compState.testResults = [];
							compState.score = 0;
							const pMax = (comp.expectedOutput !== undefined && comp.expectedOutput !== null ? 1 : 0)
								+ (comp.testCases && Array.isArray(comp.testCases) ? comp.testCases.length : 0);
							compState.maxScore = pMax;
							calculatedMaxScore += pMax;
							compState.completed = false;
							compState.attempts = 0;
						}

						// Add to the map
						pageState.components[comp.id] = compState;
					});
				}

				this.data.delta.pagesState.push(pageState);

				return {
					...page,
					path: `lessons/${page.name}`,
					maxScore: calculatedMaxScore,
				};
			});
		} catch(error){
			console.error("Failed to load course data: ", error);
		}
	},



	setTheme: function(themeName){
		this.currentTheme = themeName;

		// Apply to the parent HTML tag
		if (themeName === "light") {
			document.documentElement.removeAttribute("data-theme");
		} else {
			document.documentElement.setAttribute("data-theme", themeName);
		}

		// Send it to the child iframe
		this.sendMessage("SET_THEME", themeName);
	},

};

// --- End of Objects ---

window.onload = async () => {

	// Write some loading text into the iframe
	const iframe = document.getElementById("lesson-frame");
	iframe.src = "about:blank";
	const doc = iframe.contentDocument || iframe.contentWindow.document;
	doc.open();
	doc.write('<!doctype html><html lang="en">Loading…</html>');
	doc.close();

	// Start the web app
	await state.init("lesson-frame");
	window.addEventListener("message", state.handleMessage.bind(state));
};

window.onbeforeunload = () => {
	if(!state.data.pages || state.data.pages.length === 0){
		console.debug("pages not loaded");
		return;
	}
	if(state.pauseSave){
		console.debug("PauseSave active — skipping unload save");
		return;
	}
	// Sync save (no compression — async won't complete before unload)
	try {
		const delta = state.serialize();
		journaler._currentLog.push(...journaler._eventBuffer);
		journaler._eventBuffer = [];
		const raw = [
			journaler._version,
			journaler._userID,
			journaler._toBase36(journaler._startTime),
			...delta.map(d => typeof d === "number" ? journaler._toBase36(d) : d),
			journaler._currentLog.join(journaler._logDelimiter),
		].join(journaler._delimiter);
		lms.saveData(raw);
	} catch(e) {
		console.error("beforeunload save error", e);
	}
	if(!state.data.delta.pagesState[state.data.delta.currentPageIndex].completed){
		return "Your progress on the current page my be lost.";
	}
};

window.onunload = () => {
	// TODO handle this better with mobile
	// See: https://developer.mozilla.org/en-US/docs/Web/API/Window/unload_event
	state.quit();
};
