const debugging = true;
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
	infoBanner: null, // Will hold the banner element
	infoBar: null, // Will hold progress for the user and other info
	helpOverlay: null, // The overlay of the help window
	helpContent: null, // Content of the help window
	isPaused: false, // Flag to pause timers when the user is looking at the help window
	pauseSave: false, // Flag to pause the save on a reset
	test: null, // Used for debugging
	studentName: "",
	studentID: "",
	sessionStartTime: 0, // Logs how long the student has been on today
	isIdle: false, // Tracks if the user is idle on the site to help balance logs
	focusTimer: null, // handles timing between focus checks
	pageAPISecret: null,
	currentTheme: "light",
	lastActiveElement: null, // Holds last tabbed element for keyboard use
	initialized: false,

	init: async function(frameId, bannerId, infoBar) {
		// Set up LMS connection
		if(!lms.initialized) lms.init();

		// Set the student's name
		this.studentName = lms.getStudentName().split(",")[1] || ""; // returns first name (Lastname,Firstname)

		// Set the student's ID
		this.studentID = lms.getStudentID();

		// Set up journaler and give it access to the alert and lockdown features for critical events (like possible data corruption)
		if(!journaler.initialized) await journaler.init(this.alert.bind(this), this.lockDown.bind(this));

		// Set the date and time of us starting today. TODO consider not using the user for time
		this.sessionStartTime = Date.now();

		// Finds the required iframe and banner
		this.lessonFrame = document.getElementById(frameId);
		this.infoBanner = document.getElementById(bannerId);
		this.infoBar = document.getElementById(infoBar);

		// Set up help window
		this.helpOverlay = document.getElementById("help-overlay");
		this.helpContent = document.getElementById("help-content");

		// Attempt to load the course (static data)
		await this.loadCourseData();

		// Attempt to load the saved state
		await this.loadSave();

		// Set up API Secret for the pages (auth)
		this.pageAPISecret = this.generatePasscode();

		// Load last webpage we were on
		this.lessonFrame.src = this.data.pages[this.data.delta.currentPageIndex].path;

		// Start event listeners and timers
		this.startEventListeners();

		// Update the UI bar
		this.updateInfo();

		// Mark done
		this.initialized = true;
	},

	generatePasscode: function () {
		// Creates random passcodes
		if(typeof crypto !== "undefined" && crypto.randomUUID){
			return crypto.randomUUID();
		}

		// if the browser does not support it, try secure random
		const length = 32;
		const cryptoObj = window.crypto || window.msCrypto;
		if(cryptoObj){
			const items = new Uint8Array(length);
			cryptoObj.getRandomValues(items);
			return items.join("");
		}

		// if it does not support any of that, its Math.random time with 32 floats
		const result = [];
		for(let i = 0; i < length; i++){
			result.push(Math.random() * (Math.random()*1000).toFixed(0));
		}
		return result.join("");
	},

	startEventListeners: function(){

		// make infoBanner close on click
		this.infoBanner.addEventListener("click", () => {this.infoBanner.style.display = "none";});

		// Add the Esc key as a shortcut to closing the info banner
		const handleShortcuts = (e) => {
			if (e.key === "Escape" || e.code === "Escape") {
				// Check if Help Modal is open
				if (this.helpOverlay && this.helpOverlay.style.display === "flex") {
					e.preventDefault();
					this.closeHelp();
				} else if (this.infoBanner.style.display === "flex") {
					// Check if banner visible
					e.preventDefault();
					this.infoBanner.style.display = "none";
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
			if (this.isPaused) return; // Disabled when looking at help menu
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
			if (this.isPaused) return; // Disabled when looking at help menu
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

	updateInfo: function (){
		// Updates the info bar on the bottom of the UI
		const currentPage = this.data.delta.currentPageIndex+1;
		const pageCount = this.data.pages.length;

		// Prevent divide-by-zero if there is only 1 page in the whole course
		const totalSteps = Math.max(1, pageCount - 1);
		const progress = Math.round((this.data.delta.progress / totalSteps) * 100);

		// Inject the background fill div and the text span
		this.infoBar.innerHTML = `
			<div id="info-bar-fill" style="width: ${progress}%;"></div>
			<span id="info-bar-text">Page ${currentPage} of ${pageCount} &nbsp;&nbsp;&bull;&nbsp;&nbsp; ${progress}% Complete</span>
		`;
	},

	handleLastPage: function(){
		// Checks if we are done with the course
		if(!this.checkCourseCompletion()) return false;

		// Calculate score and log
		const grade = this.calculateOverallGrade();
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
		this.showEndScreen(hasPassed, gradeString, Math.round(minimumGrade * 100));
		return true;
	},

	finalizePage: function(){
		const pageDelta = this.data.delta.pagesState[this.data.delta.currentPageIndex];
		if(this.checkIfComplete() && this.data.delta.currentPageIndex === this.data.delta.progress && pageDelta.completed === false){
			pageDelta.completed = true;
			this.data.delta.progress += 1;
			this.log(`Page ${this.data.delta.currentPageIndex} completed`);
			journaler.log("PAGE_COMPLETE", this.data.delta.currentPageIndex);
			this.bannerMessage("This page is completed. You may continue", false);
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
			if(this.checkCourseCompletion()){
				this.handleLastPage();
			} else {
				this.bannerMessage("You have not finished all course requirements. Review your work and try again.");
			}
		} else {
			// Just go to the next page
			this.data.delta.currentPageIndex += 1;
			this.lessonFrame.src = this.data.pages[this.data.delta.currentPageIndex].path;
		}
	},

	next: function() {
		if(this.initialized === false){
			console.error("Cannot go to next page until the state is initialized. Run state.init() first");
			return false;
		}
		this.infoBanner.style.display = "none"; //reset banner

		const pageDelta = this.data.delta.pagesState[this.data.delta.currentPageIndex];

		if(this.checkIfComplete() && !pageDelta.completed){
			// if we just completed the page
			pageDelta.completed = true;
			this.log(`Page ${this.data.delta.currentPageIndex} completed`);
			this.advancePage();
		} else if(pageDelta.completed) {
			//if we are on a completed page
			// see if we can go next
			this.advancePage();
		} else {
			// if we did not complete the page
			this.bannerMessage("You must complete the current page to continue");
			journaler.log("ADVANCE_DENIED", this.data.delta.currentPageIndex);
		}
		this.updateInfo();
	},

	prev: function() {
	// Tries to go back a page
		if (!this.lessonFrame || !this.infoBanner) {
			console.error("State not initialized. Call state.init() first.");
			return;
		}

		// Hide any old errors
		this.infoBanner.style.display = "none";

		// Deccrement index
		this.data.delta.currentPageIndex--;

		// Check if we are at the end
		if (this.data.delta.currentPageIndex < 0) {
			this.bannerMessage("Cannot go back. You are on the first page");
			this.data.delta.currentPageIndex = 0;
			return;
		}

		// Set the iframe source
		this.lessonFrame.src = this.data.pages[this.data.delta.currentPageIndex].path;
		this.updateInfo();
	},

	save: async function(){
	// saves the state to the local browser storage
		if(this.pauseSave){ console.log("Ignoring Save"); return;}

		const saveData = this.serialize();

		const compressed = await journaler.pack(saveData);

		// Try to save with the LMS
		if(compressed){
			lms.saveData(compressed);
			const progress = Math.round((this.data.delta.progress/(this.data.pages.length-1))*100);
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
				console.error(`state.loadSave: Unable to parse saved data of \n${stateAsString}\n --> ${e}`);
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
			console.log("Resetting progress");
			//localStorage.removeItem("courseProgress");
			lms.reset(); // <-- set the saved data to nothing
			this.lessonFrame.src = this.data.pages[0].name + "?_cb=" + Date.now();
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
		window.onbeforeunload = () => console.log("Stopping prompt");
		window.onunload = () => console.log("Stopping quit");

		// nuke the state and its modules
		state = "";
		journaler = "";
		lms = "";

		// now the user cannot destroy their saved file, unless they refresh!

	},

	quit: function(){
		if(!this.sessionStartTime) return; // <-- if not initialized

		const sessionDuration = Date.now() - this.sessionStartTime;

		lms.setSessionTime(sessionDuration);

		lms.quit();
	},

	checkIfComplete: function() {
		const page = this.data.pages[this.data.delta.currentPageIndex];
		const pageDelta = this.data.delta.pagesState[this.data.delta.currentPageIndex];

		// Calculate score ratio or set to zero (stops / by 0)
		const score = page.maxScore > 0 ? pageDelta.score / page.maxScore : 0;

		let quizzesSatisfied = true;

		if (page.completionRules.requireSubmission) {
			// Get IDs of all quiz components on this page from static config
			const quizComponents = (page.components || []).filter(c => c.type === "quiz");

			// Check if every quiz has been marked 'completed' in the dynamic state
			// Note: compState.completed is set to true in handleMessage > QUIZ_RESULT
			quizzesSatisfied = quizComponents.every(q => {
				const compState = pageDelta.components[q.id];
				return compState && compState.completed === true;
			});
		}

		return (
			pageDelta.watchTime >= page.completionRules.watchTime &&
			score >= page.completionRules.score &&
			(!page.completionRules.scrolled || pageDelta.scrolled) &&
			pageDelta.videoProgress >= page.completionRules.videoProgress &&
			quizzesSatisfied
		);
	},

	calculateOverallGrade: function (){
		// Calculate score dynamically
		const earnedScore = this.data.delta.pagesState.reduce((acc, p) => acc + p.score, 0); // <-- what the user earned
		const maxScore = this.data.pages.reduce((acc, p) => acc + p.maxScore, 0);
		return ({ratio: earnedScore / maxScore, earnedScore: earnedScore, maxScore: maxScore});
	},

	checkCourseCompletion: function(){
		const isTimeRequirementMet = (this.data.courseRules.minimumMinutes * 60) <= this.data.delta.totalCourseSeconds;
		const isScoreMet = this.data.courseRules.minimumGrade <= this.calculateOverallGrade().ratio;
		const studentsCanFail = this.data.courseRules.studentsCanFail;

		if(isTimeRequirementMet && (isScoreMet || studentsCanFail)){
			this.data.delta.pagesState[this.data.pages.length-1].completed = true;
			// set the good bye page to completed since the important course information is done
			// this also allows us to check all the other ones
		}
		const isEveryPageComplete = this.data.delta.pagesState.every(p => p.completed);
		//return (isLastPage && isTimeRequirementMet && isScoreMet && isEveryPageComplete);
		return (isTimeRequirementMet && (isScoreMet || studentsCanFail) && isEveryPageComplete);
	},

	sendMessage: function(subject, message){
		this.lessonFrame.contentWindow.postMessage({ type: subject,
			message: message}, "*");
	},

	handleMessage: function(event){
		//console.log(event);
		const index = this.data.delta.currentPageIndex;
		const page = this.data.pages[index];
		const pageDelta = this.data.delta.pagesState[this.data.delta.currentPageIndex];
		const name = this.handleMessage.name;
		const roundTo4 = n => Math.round(n*10000)/10000;

		if(event.origin != window.location.origin){
			console.error(`${name}: Unknown message sender! --> ${event}`);
			return;
		}

		// 1. UNWRAP the message
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
				this.lessonFrame.contentWindow.postMessage({ type: "ORIGIN", message: window.location.origin, code: this.pageAPISecret }, "*");
				console.log("Auth Attempt");
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
								attemptsLeft: page.completionRules.attempts - compState.attempts, // <--- The updated count
								options: compConfig.options || [], // Add options to the specific quiz, like "show-wrong"
								hasAttempted: compState.attempts > 0, // Flag to check attempts
							},
						},
					}, "*");

					this.finalizePage();
				}
				break;

			case "GET_QUIZ_DATA":
				// Composite Logic ---
				if(componentID && page.components){
					console.log(`comp -->\n${page.components}`);
					const compConfig = page.components.find(c => c.id === componentID);
					const compState = pageDelta.components[componentID];

					if(compConfig && compState){
						const quizPayload = {
							questions: compConfig.questions,
							userAnswers: compState.userAnswers || {},
							attemptsLeft: page.completionRules.attempts - (compState.attempts || 0),
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
						}, "*");
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

			case "GET_STUDENT_DATA":
				const grade = String(Math.floor((this.calculateOverallGrade().ratio * 100)));
				this.lessonFrame.contentWindow.postMessage({ type: "GET_STUDENT_DATA", message: {
					name: this.studentName, grade: grade } }, "*");
				journaler.log("GENERAL", "student info requested, page " + String(index));
				break;

			case "SEND_RENDER":
				console.log(`${name}: SEND_RENDER not implemented yet`);
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

	bannerMessage: function(message, isError=true){
		// Shows a message in a banner at the top center

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
			<span role="${role}">${message}</span>
		`;

		// Displays using Flexbox so the icon and text aligns perfectly
		this.infoBanner.style.display = "flex";
	},

	log: function(message){
		journaler.log("GENERAL", message);
	},

	alert: function(message){
		//handles critical alerts to the user. useful if the calling object does not need a DOM
		return confirm(message);
	},

	gradeQuizQuestions: function(questions, responses){
		//compares answers to response, marks them correct or incorrect, adds up points of the correct ones, adds up total points, returns the score
		// questions is an object, responses are a 2D array of strings
		this.test = responses;
		questions.forEach(q => q.choices = responses[q.id] || []); // <-- add responses to the question to save for later TODO check if choices[i] is needed
		//TODO consider merging both lists and seeing if the neighbor element is the same?
		const sortAndLower = arr => // <-- takes in an array (arr), returns either the sorted lowercase array (arr) or empty []. slice makes a new copy, map makes all time change
			(arr || []).slice().map(s => String(s).toLowerCase()).sort();

		questions.forEach(q => { // <-- goes through each question, sets the isCorrect flag if the converted & sorted answer is the same as the response
			const a = sortAndLower(q.correctAnswers);
			const r = sortAndLower(q.choices);
			q.isCorrect = (a.length === r.length &&
				a.every((e, i) => e === r[i])
			);
		});

		const score = questions.reduce((acc, q) => acc + (q.isCorrect ? q.pointValue : 0), 0); // <-- check and add every correct answer. Add 0 if not correct
		const maxScore = questions.reduce((acc, q) => acc + q.pointValue, 0); // <-- tally all the possible points

		if(maxScore <= 0){
			console.error("state.gradeQuizQuestions: Max score set too low --> ", maxScore);
			return -1;
		}
		return ({score: score, maxScore: maxScore});
	},

	loadCourseData: async function(){
		/* Sets up the state of the program
		 * Loads and sets up static data objects
		 * Loads and sets up dynamic data objects
		 */
		try {
			let response = null;
			if(debugging){
				console.log("Skipping cache for JSON");
				response = await fetch("lessons/course_data.json", {
					cache: "no-store",
				});
			} else {
				response = await fetch("lessons/course_data.json");
			}
			console.log("Loaded course_data.json");
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
					page.components.forEach(comp => {
						if(!comp.id) console.error(`Component on page '${page.name}' missing ID`);

						// Initialize specific state for this component
						const compState = {
							type: comp.type,
							completed: false,
						};

						// Add type-specific defaults
						if (comp.type === "quiz") {
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

	toggleHelp: function(){
		// Makes the ? nav button toggle from showing help menu or closing it
		if (this.helpOverlay.style.display === "flex") {
			this.closeHelp();
		} else {
			this.showHelpMenu();
		}
	},

	showHelpMenu: function(){
		// Displays the help menu from the ? nav button

		this.lastActiveElement = document.activeElement; // Save last tabbed element
		this.isPaused = true;
		this.lessonFrame.style.display = "none";
		this.helpOverlay.style.display = "flex";

		// Disable the navigation while the help menu is up
		document.getElementById("prev").disabled = true;
		document.getElementById("next").disabled = true;

		this.helpContent.innerHTML = `
			<div class="help-wrapper centered">
				<h1 id="modal-title" class="help-title no-border">Course Help</h1>
				<p class="help-subtitle" style="margin-bottom: 40px;">Select an option below to continue.
				<br><br> If you run into an issue during the course,
				go through each menu, from top to bottom, until the issue is resolved</p>
				<div class="help-btn-group-col">
					<button class="help-action-btn" onclick="state.showPageHelp()">
						📄 Help with Current Page
					</button>

					<button class="help-action-btn" onclick="state.showGeneralHelp()">
						❓ General Course Help
					</button>

					<button class="help-action-btn" onclick="state.refreshBrowser()">
					🔄 Refresh This Web Page
					</button>

					<button class="help-action-btn danger" onclick="state.reset()">
						⚠️ Reset Course Progress
					</button>
				</div>
			</div>
		`;

		// Move tab selection
		setTimeout(() => {
			const closeBtn = document.getElementById("close-help");
			if (closeBtn) closeBtn.focus();
		}, 50);
	},

	showPageHelp: function(){
		// A menu to show page rules to the user to see whats left
		const page = this.data.pages[this.data.delta.currentPageIndex];
		const pageDelta = this.data.delta.pagesState[this.data.delta.currentPageIndex];
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

		// Uses the new CSS classes for the checkmarks!
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

		if (rules.watchTime > 0) html += `<tr><td>Time on Page</td><td>${rules.watchTime} seconds</td><td>${pageDelta.watchTime} seconds</td><td>${formatIcon(checks.watchTime)}</td></tr>`;
		if (rules.score > 0) html += `<tr><td>Minimum Score</td><td>${Math.round(rules.score * 100)}%</td><td>${Math.round(scorePct * 100)}%</td><td>${formatIcon(checks.score)}</td></tr>`;
		if (rules.scrolled) html += `<tr><td>Read Entire Article</td><td>Scroll to Bottom</td><td>${pageDelta.scrolled ? "Scrolled" : "Not Scrolled"}</td><td>${formatIcon(checks.scrolled)}</td></tr>`;
		if (rules.videoProgress > 0) html += `<tr><td>Watch Video</td><td>${Math.round(rules.videoProgress * 100)}%</td><td>${Math.round(pageDelta.videoProgress * 100)}%</td><td>${formatIcon(checks.videoProgress)}</td></tr>`;
		if (rules.requireSubmission) html += `<tr><td>Submit Quizzes</td><td>Submit all</td><td>${quizzesSatisfied ? "Submitted" : "Pending"}</td><td>${formatIcon(checks.requireSubmission)}</td></tr>`;

		html += `</table>
			<div class="help-btn-group-row">
				<button class="help-action-btn auto-width" onclick="state.showPageHelp()">🔄 Refresh Status</button>
				<button class="help-action-btn auto-width" onclick="state.showHelpMenu()">&larr; Back to Menu</button>
				</div>
			</div>
		`;

		this.helpContent.innerHTML = html;
	},

	showGeneralHelp: function(){
		// Opens the help page on how to navigate the course
		this.helpContent.innerHTML = `
			<div class="help-wrapper">
			<iframe src="help.html" class="help-iframe"></iframe>
			<div class="help-btn-group-row" style="margin-top: 15px;">
				<button class="help-action-btn auto-width" onclick="state.showHelpMenu()">&larr; Back to Menu</button>
			</div>
			</div>
		`;
	},

	closeHelp: function(){
		// Closes the Help (aka ?) menu and Settings menu
		this.helpOverlay.style.display = "none";
		this.helpContent.innerHTML = "";
		this.lessonFrame.style.display = "block";
		this.isPaused = false; // Unfreeze analytics

		// Reenable course navigation
		document.getElementById("prev").disabled = false;
		document.getElementById("next").disabled = false;

		// Move tabbed element back
		if (this.lastActiveElement) {
			this.lastActiveElement.focus();
			this.lastActiveElement = null;
		}
	},

	showEndScreen: function(hasPassed, scoreString, requiredScoreString) {
		// End of course pop up

		this.isPaused = true;
		this.lessonFrame.style.display = "none";
		this.helpOverlay.style.display = "flex";

		// Lock navigation
		document.getElementById("prev").disabled = true;
		document.getElementById("next").disabled = true;
		this.lastActiveElement = document.activeElement;

		const certConfig = this.data.courseRules.certificate || {};
		const showCertButton = hasPassed && certConfig.enabled;

		// Build the messaging based on pass/fail
		let title = hasPassed ? "🎉 Course Completed!" : "⚠️ Course Incomplete";
		let message = hasPassed
			? `Congratulations! You have successfully finished the course with a score of <strong>${scoreString}%</strong>.`
			: `You reached the end, but you scored <strong>${scoreString}%</strong>. A score of <strong>${requiredScoreString}%</strong> is required to pass.`;

		let certButtonHTML = showCertButton
			? `<button class="help-action-btn" onclick="state.printCertificate()" style="background-color: var(--brand); color: var(--brand-text);">🖨️ Print Certificate</button>`
			: "";

		this.helpContent.innerHTML = `
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
		// Generates and prints the end of course cert
		const certConfig = this.data.courseRules.certificate || {};
		const printArea = document.getElementById("certificate-print-area");

		if (!printArea) {
			console.error("Unable to find print area for the cert!");
			return;
		}

		// Gather our template variables
		const student = this.studentName || "Student";
		const scoreString = String(Math.round(this.calculateOverallGrade().ratio * 100));
		const dateString = new Date().toLocaleDateString();

		// Time tracking
		const totalSeconds = this.data.delta.totalCourseSeconds || 0;
		const totalMinutes = String(Math.floor(totalSeconds / 60));
		// Uses parseFloat to cleanly drop trailing zeros (e.g., 1.50 becomes 1.5)
		const totalHours = String(parseFloat((totalSeconds / 3600).toFixed(2)));
		const minimumLength = String(this.data.courseRules.minimumMinutes || 0);

		// Text Replacer Engine
		const titleText = certConfig.title || "Certificate of Completion";
		let bodyText = certConfig.body || "This certifies that {{studentName}} completed the course on {{date}} with a score of {{score}}%.";

		bodyText = bodyText.replace(/{{studentName}}/g, student);
		bodyText = bodyText.replace(/{{score}}/g, scoreString);
		bodyText = bodyText.replace(/{{date}}/g, dateString);
		bodyText = bodyText.replace(/{{totalMinutes}}/g, totalMinutes);
		bodyText = bodyText.replace(/{{totalHours}}/g, totalHours);
		bodyText = bodyText.replace(/{{minimumLength}}/g, minimumLength);
		bodyText = bodyText.replace(/\n/g, "<br>");

		// Optional Image Engine (Checks if the variables exist in JSON)
		const logoHTML = certConfig.logoUrl
			? `<img src="${certConfig.logoUrl}" style="max-height: 80px; margin-bottom: 20px;" alt="" />`
			: "";

		const signatureHTML = certConfig.signatureUrl
			? `
			<div style="width: 250px; font-size: 1.2rem;">
				<div style="border-bottom: 2px solid #333; height: 50px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
					<img src="${certConfig.signatureUrl}" style="max-height: 45px; margin-bottom: -2px;" alt="Signature" />
				</div>
				Instructor Signature
			</div>
			`
			: "";

		const watermarkHTML = certConfig.watermarkUrl
			? `<img src="${certConfig.watermarkUrl}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); max-width: 75%; max-height: 75%; opacity: 0.12; z-index: 0; pointer-events: none;" alt="" />`
			: "";

		// Inject the HTML (Using Flexbox to align the bottom columns perfectly)
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
		${dateString}
		</div>
		Date
		</div>

		<div style="width: 250px; font-size: 1.2rem;">
		<div style="border-bottom: 2px solid #333; height: 50px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px; margin-bottom: 5px;">
		${scoreString}%
		</div>
		Score
		</div>

		${signatureHTML}
		</div>
			`;

		// Trigger the browser's native print dialog
		window.print();
	},

	toggleSettings: function(){
		if (this.helpOverlay.style.display === "flex") {
			this.closeHelp(); // We reuse closeHelp since it just closes the modal
		} else {
			this.showSettingsMenu();
		}
	},

	showSettingsMenu: function(){
		// Very similar to the Help (?) button

		this.lastActiveElement = document.activeElement; // Save tab selection
		this.isPaused = true;
		this.lessonFrame.style.display = "none";
		this.helpOverlay.style.display = "flex";

		document.getElementById("prev").disabled = true;
		document.getElementById("next").disabled = true;

		// Check the current theme so the dropdown shows the correct active choice
		const lightSel = this.currentTheme === "light" ? "selected" : "";
		const darkSel = this.currentTheme === "dark" ? "selected" : "";
		const hcSel = this.currentTheme === "high-contrast" ? "selected" : "";

		this.helpContent.innerHTML = `
			<div class="help-wrapper centered">
				<h1 id="modal-title" class="help-title no-border">Course Settings</h1>
				<p class="help-subtitle" style="margin-bottom: 40px;">Adjust your course preferences below.</p>

				<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 10px; width: 100%; max-width: 350px;">
					<label for="theme-select" style="font-size: 1.2rem; font-weight: bold; color: var(--text-main);">Color Theme</label>
					<select id="theme-select" onchange="state.setTheme(this.value)" style="width: 100%; padding: 12px; font-size: 1.1rem; border-radius: 8px; border: 2px solid var(--border-color); background: var(--bg-main); color: var(--text-main); cursor: pointer;">
					<option value="light" ${lightSel}>Light Mode (Default)</option>
					<option value="dark" ${darkSel}>Dark Mode</option>
					<option value="high-contrast" ${hcSel}>High Contrast</option>
					</select>
				</div>
			</div>
		`;

		// Move tab selection
		setTimeout(() => {
			const closeBtn = document.getElementById("close-help");
			if (closeBtn) closeBtn.focus();
		}, 50);
	},

	refreshBrowser: function(){
		// A simple button to refresh the web page for the user
		// Force a save just in case
		this.save();

		// Reload the entire web app. The main page leaving event will prompt
		window.location.reload();
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
	await state.init("lesson-frame", "info-banner", "info-bar");
	window.addEventListener("message", state.handleMessage.bind(state));
};

window.onbeforeunload = () => {
	if(!state.data.pages || state.data.pages.length === 0){
		console.log("pages not loaded");
		state.save();
		return;
	}
	state.save();
	if(!state.data.delta.pagesState[state.data.delta.currentPageIndex].completed){
		return "Your progress on the current page my be lost.";
	}
};

window.onunload = () => {
	// TODO handle this better with mobile
	// See: https://developer.mozilla.org/en-US/docs/Web/API/Window/unload_event
	state.quit();
};
