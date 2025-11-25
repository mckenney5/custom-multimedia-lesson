const debugging = true;
let state = {
	// --- Properties (Data) ---
	data: {
		pages: [],
		currentPageIndex: 0,
		progress: 0, // Sets the furthest we have been
		totalCourseSeconds: 0,
		log: [],
	},
	// --

	lessonFrame: null,	 // Will hold the iframe element
	infoBanner: null, // Will hold the banner element
	pauseSave: false, // Flag to pause the save on a reset
	test: null, // Used for debugging
	studentName: "",

	init: function(frameId, bannerId) {
		// Set up LMS connection
		if(!lms.initialized) lms.init();

		// Set the students name
		this.studentName = lms.getStudentName().split(',')[1] || ""; // returns first name

		// finds the required iframe and banner
		this.lessonFrame = document.getElementById(frameId);
		this.infoBanner = document.getElementById(bannerId);
		this.infoBanner.addEventListener("click", () => {this.infoBanner.style.display = "none"});

		// load last webpage we were on
		this.lessonFrame.src = this.data.pages[this.data.currentPageIndex].path;

		// track the time in the course and page
		setInterval(() => {
			if(++this.data.totalCourseSeconds % 60 == 0){
				if(!debugging) this.save();
			}
			const page = this.data.pages[this.data.currentPageIndex];
			page.watchTime += 1;
			this.finalizePage();

		}, 1000);
	},

	next: function() {
	// Trys to go to the next page and update progress
		if (!this.lessonFrame || !this.infoBanner) {
			console.error("State not initialized. Call state.init() first.");
			return;
		}
		this.finalizePage(); //check progress
		const page = this.data.pages[this.data.currentPageIndex];
		if (page.completed) {
			// Hide any old errors
			this.infoBanner.style.display = "none";

			// Increment index
			this.data.currentPageIndex++;

			// Check if we are at the end
			if (this.data.currentPageIndex >= this.data.pages.length) {
				// We're on the last page, maybe show a "Course Complete" message
				alert("Congratulations! You have finished the course! You may close the window");
				this.data.currentPageIndex = this.data.pages.length - 1; // Stay on last page
				return; // Don't try to load a page that doesn't exist
			}

			// Get the new page name

			// Set the iframe source
			this.lessonFrame.src = this.data.pages[this.data.currentPageIndex].path;

		} else {
			// Show an error
			this.bannerMessage("Please complete all items on the page");
		}
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
		this.data.currentPageIndex--;

		// Check if we are at the end
		if (this.data.currentPageIndex < 0) {
			this.bannerMessage("Cannot go back. You are on the first page");
			this.data.currentPageIndex = 0;
			return;
		}

		// Set the iframe source
		this.lessonFrame.src = this.data.pages[this.data.currentPageIndex].path;
	},

	save: function(){
	// saves the state to the local browser storage
		if(this.pauseSave){ console.log("Ignoring Save"); return;}

		let stateAsString = JSON.stringify(this.data);

		// Save locally as a back up TODO see if still needed
		//localStorage.setItem("courseProgress", stateAsString);
		//this.log("Course Progress Saved Locally");

		// Try to save with the LMS
		lms.saveData(stateAsString);

	},

	loadSave: function(){
	// loads the state from the local browser
		// Try to load from the LMS first
		let stateAsString = lms.loadData();

		// If that fails, try local backup
		/*if(!stateAsString){
			stateAsString = localStorage.getItem("courseProgress");
		}*/

		if(stateAsString) {
			// If data is there, try to load it
			try {
				let loadedState = JSON.parse(stateAsString);
				this.log("Loaded progress from the LMS/Local Storage");
				Object.assign(this.data, loadedState); // <-- merge data and the loaded state
			} catch(e) {
				console.error("Unable to parse saved data --> ", e);
			}
		} else {
			this.log("Started new course");
		}
	},

	reset: function(){
	// reset the state
		let confirmed = window.confirm("Are you sure you want to reset all of your progress? This action cannot be undone.");
		if(confirmed){
			this.pauseSave = true;
			console.log("Resetting progress");
			//localStorage.removeItem("courseProgress");
			lms.reset(); // <-- set the saved data to nothing
			this.lessonFrame.src = this.data.pages[0].name + '?_cb=' + Date.now();
			// TODO check if we are debugging, if so, delete the saved log too
			window.onbeforeunload = null;
			window.location.reload();
		}
	},

	checkIfComplete: function() {
		const page = this.data.pages[this.data.currentPageIndex];

		// Calculate score ratio or set to zero (stops / by 0)
		const score = page.maxScore > 0 ? page.score / page.maxScore : 0;

		return (
			page.watchTime >= page.completionRules.watchTime &&
			score >= page.completionRules.score &&
			page.scrolled === page.completionRules.scrolled &&
			page.videoProgress >= page.completionRules.videoProgress
		)
	},

	finalizePage: function(){
		const page = this.data.pages[this.data.currentPageIndex];
		if(this.checkIfComplete() && this.data.currentPageIndex === this.data.progress){
			page.completed = true;
			this.data.progress += 1;

			// Check if the course is done
			if(this.data.progress >= this.data.pages.length){
				//TODO check each page completion status too
				lms.setStatus("completed");

				// Calculate score
				const earnedScore = this.data.pages.reduce((acc, p) => acc + p.score, 0); // <-- what the user earned
				const maxScore = this.data.pages.reduce((acc, p) => acc + p.maxScore, 0); // <-- max possible score
				const grade = String((earnedScore / maxScore) * 100); // <-- percentage grade as a string
				lms.setScore(earnedScore, maxScore); // <-- send course score to the LMS
				this.log("Course Completed with a Grade of " + grade);
			}

			this.save();
			this.log(`Page ${this.data.currentPageIndex} completed`);
			this.bannerMessage("This page is completed. You may continue", false);
			return true;
		}
		return false;
	},

	handleMessage: function(event){
		//console.log(event);
		const page = this.data.pages[this.data.currentPageIndex];
		if(event.origin != window.location.origin){
			console.log("Unknown Sender!");
			return;
		}
		if(event.data.type === "QUIZ_SUBMITTED"){
			this.log(page.name + " Quiz was submitted");
			const grades = this.gradeQuizQuestions(page.questions, event.data.message);
			page.score = grades.score;
			page.maxScore = grades.maxScore;
			this.finalizePage();
			this.lessonFrame.contentWindow.postMessage({ type: "QUIZ_INFO", score: page.score / page.maxScore, maxAttempts: page.completionRules.attempts - ++page.attempts  }, '*');
		} else if(event.data.type === "QUIZ_ADD_QUESTIONS"){
			// Page requests the quiz to be rendered from the JSON, and gets the rendered HTML returned
			this.log(page.name + " Quiz questions added");
			//this.setQuizQuestions(String(this.data.currentPageIndex), event.data.message);
			this.lessonFrame.contentWindow.postMessage({ type: "QUIZ_ADD_QUESTIONS", message: this.renderQuiz(this.data.currentPageIndex)}, '*');
		} else if(event.data.type === "LOG"){
			this.log(`${page.name} ${event.data.message}`);
		} else if(event.data.type === "PAGE_SCROLLED"){
			this.log(page.name + " Page was scrolled all the way down");
			page.scrolled = event.data.scrolled;
		} else if(event.data.type === "VIDEO_PROGRESS"){
			page.videoProgress = event.data.message;
		} else if(event.data.type === "GET_STUDENT_DATA"){
			// Returns name and current grade so far
			const earnedScore = this.data.pages.reduce((acc, p) => acc + p.score, 0); // <-- what the user earned
			const maxScore = this.data.pages.reduce((acc, p) => acc + p.maxScore, 0); // <-- max possible score
			const grade = String((earnedScore / maxScore) * 100); // <-- percentage grade as a string
			this.lessonFrame.contentWindow.postMessage({ type: "GET_STUDENT_DATA", name: this.studentName, grade: grade }, '*');
		} else {
			console.log("Unknown message --> ", event.data);
			return;
		}
		this.finalizePage();
	},

	bannerMessage: function(message, isError=true){
		if(isError){
			this.infoBanner.style = "background-color: #f8d7da; color: #721c24;";
		} else {
			this.infoBanner.style = "background-color: #fff3cd; color: #856404;";
		}
		this.infoBanner.innerHTML = `<p>${message}</p>`;
		this.infoBanner.style.display = "block";
	},

	log: function(message){
		this.data.log.push(`[${new Date().toLocaleTimeString()}] ${message}`);
		if(debugging) console.log("log --> " + message);
	},

	setQuizQuestions: function(pageName, data){
		// sets a list of questions to a page
		this.data.quizes[pageName] = data;
		console.log(`${pageName} | ${data}`);
		console.log(this.data.quizes);
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
			console.error("Max score set too low --> ", maxScore);
			return -1;
		}

		console.log(questions);
		console.log(score/maxScore);
		return ({score: score, maxScore: maxScore});
	},

	gradeQuizQuestions2: function(questions, responses){
		// NOTE not currently used. Goal is to check functional vs procedural attempts. Does not currently work
		let score = 0.0;
		let maxPoints = 0.0;
		for(let i = 0; i < questions.length; i++){
			questions[i].choices = responses[questions[i].id].slice().sort();

			for(let l = 0; l < questions[i].correctAnswers.length; l++){
				questions[i].correctAnswers[l] = questions[i].correctAnswers[l].toLowerCase();
			}
			for(let l = 0; l < questions[i].choices.length; l++){
				questions[i].choices[l] = questions[i].choices[l].toLowerCase();
			}
			questions[i].isCorrect = (
				questions[i].correctAnswers.length === questions[i].choices.length &&
				questions[i].correctAnswers.sort() === questions[i].choices.sort() //<-- this needs its own for loop and string conversion to compare
			);
			console.log(`length --> ${questions[i].correctAnswers.length} ${questions[i].choices.length} | items --> ${questions[i].correctAnswers} ${questions[i].choices}`);
			console.log(`len eval --> ${questions[i].correctAnswers.length === questions[i].choices.length} | ans eval --> ${questions[i].correctAnswers.sort() === questions[i].choices.sort()}`);
			if(questions[i].isCorrect){
				score += questions[i].pointValue;
			}
			maxPoints += questions[i].pointValue;
		}
		if(maxPoints <= 0){
			console.error("Max points set too low --> ", maxPoints);
			return -1;
		}
		console.log(questions);
		console.log(score/maxPoints);
		return (score/maxPoints);
	},

	renderQuiz: function(index){
		// Puts all of the questions on the screen, in their own DIV
		let QUIZ_QUESTIONS = this.data.pages[index].questions;
		console.log(QUIZ_QUESTIONS);
		let html = "";

		// add feedback div to show submission and test score
		html += '<div id="feedback" style="display: none; margin-top: 20px;"><p>Your answer has been submitted to the LMS.</p></div>';

		for(let i = 0; i < QUIZ_QUESTIONS.length; i++){
		// Render every question in a div
			if(i % 2 == 0){
			// alternate background colors
				html += `<div id="Q${i+1}" style="background: lightgray;">`;
			} else {
				html += `<div id="Q${i+1}" style="background: white;">`;
			}

			// Render quiz question and number
			html += `<h3 id="text">${i+1}. ${QUIZ_QUESTIONS[i].text}</h3>`;

			for(let l = 0; l < QUIZ_QUESTIONS[i].possibleAnswers.length; l++){
			// Render every choice
				html += `
					<input id="a${l}" type="checkbox" value="${QUIZ_QUESTIONS[i].possibleAnswers[l]}">
					<label id="a${l}-label" for="a${l}">${QUIZ_QUESTIONS[i].possibleAnswers[l]}</label>
					</br>
				`;
			}
			html += "</div>";
		}

		// Render submit button
		html += "</br><button onclick='submitQuiz()'>Submit</button>";
		return html;
	},

	loadCourseData: async function(){
		try {
			let response = null;
			if(debugging){
				console.log("Skipping cache for JSON");
				response = await fetch("lessons/course_data.json", {
					cache: "no-store"
				});
			} else {
				response = await fetch("lessons/course_data.json");
			}
			console.log("Loaded JSON");
			const rawPages = await response.json();

			this.data.pages = rawPages.map(page => ({
				// take the JSON, make a new object with those attributes (...) AND add others
				...page,
				path: `lessons/${page.name}`,
				completed: false,
				// TODO make this its own object to compare with completiton rules
				scrolled: false,
				score: 0.0,
				watchTime: 0,
				attempts: 0,
				videoProgress: 0.0,
				maxScore: page.type === 'quiz' //if it is a quiz, tally up all points
					? page.questions.reduce((acc, q) => acc + q.pointValue, 0.0)
					: 0.0
			}));

		} catch(error){
			console.error("Failed to load course data: ", error);
		}
	}
};

let lms = {
	// Generic object that helps translate LMS actions to their own API
	initialized: false,
	driver: null,

	init: function(lmsType="detect") {
		// set or detects the LMS type
		if(lmsType === "detect"){
			let connected = false;
			if(window.pipwerks){
				// if pipwerks wrapper is loaded
					connected = pipwerks.SCORM.init();
			}
			if(connected){
				const version = pipwerks.SCORM.version; // "1.2" or "2004"
				return this.init(`SCORM ${version}`); // if version is null it goes to the else statement
			} else {
					return this.init("standalone");
			}
		} else if(lmsType == "SCORM 1.2"){
			this.driver = Scorm12Adapter;
			this.driver.init();
			this.initialized = true;
		} else if(lmsType == "SCORM 2004"){
			console.warn("SCORM 2004 is not supported yet. Reverting to standalone.");
			this.init("standalone");
		} else {
			// Do standalone mode - no LMS
			this.driver = LocalStorageAdapter;
			this.driver.init();
			this.initialized = true;
		}
		console.log(`LMS initialized using ${this.driver.name} driver.`);
		return this.initialized;
	},

	reset: function(){
		if(!this.initialized) return false;
		return this.driver.reset();
	},

	getStudentName: function(){
		if(!this.initialized) return false;
		return this.driver.getStudentName();
	},

	saveData: function(dataString){
		if(!this.initialized) return false;
		return this.driver.saveData(dataString);
	},

	loadData: function(){
		if(!this.initialized) return null;
		return this.driver.loadData();
	},

	setScore: function(score, maxScore){
		if(!this.initialized) return false;
		this.driver.setScore(score, maxScore);
	},

	setStatus: function(status){
		// status: "passed", "failed", "completed", "incomplete"
		if(!this.initialized) return false;
		this.driver.setStatus(status);
	},

	quit: function(){
		if(!this.initialized) return false;
		this.driver.quit();
	}

};

let Scorm12Adapter = {
	// converts commands to SCORM 1.2
	name: "SCORM 1.2",
	initialized: false,

	// --- Private Properties ---
	_saveLimit: 4095, // <-- how many chars the suspend data can be
	_validStatusValues : ["passed", "completed", "failed", "incomplete", "browsed", "not attempted"],

	// --- Private Methods ---
	_throwError: function(){
		let errCode = pipwerks.SCORM.debug.getCode();
		let errInfo = pipwerks.SCORM.debug.getInfo(errCode);
		let errDiag = pipwerks.SCORM.debug.getDiagnosticInfo(errCode);
		const err = new Error(`${this.name} LMS Errror [${errCode}] '${errInfo}'. Diagnostic Details: '${errDiag}'.`);
		console.error(`${err}\nStack --> ${err.stack}`);
		return (errCode == "0"); //return true on no error
	},

	_dataOverLimit: function(data, limit){
		if(data.length > limit){
			console.error(`Save data over the limit of ${limit}! Save rejected.`);
			return true;
		} else if(data.length >= (limit * 0.9)){
			console.warn(`Saved data within ${limit - data.length} chars of the max size of ${limit}`);
		}
		return false;
	},

	_commit: function(){
		if(debugging) console.log("Sending changes to LMS");
		const status = pipwerks.SCORM.save();
		if(!status) this._throwError();
		return status;
	},

	_set: function(key, value){
		// does error handling for setting data. Returns true on no error
		const status = pipwerks.SCORM.set(key, value);
		return status ? true : this._throwError();
	},

	// --- PUBLIC API ---
	init: function(){
		// Initalize SCORM Connection
		let status = pipwerks.SCORM.get("cmi.core.lesson_status");
		if(status === "not attempted" || status === "unknown"){
			// Tell the LMS that the user just started the lesson
			this._set("cmi.core.lesson_status", "incomplete");
			this._commit();
		}
		this.initialized = true;
	},

	reset: function(){
		console.log("Reseting SCORM variables...");

		// 1. Wipe the course data
		this._set("cmi.suspend_data", "");

		// 2. Reset Status to "incomplete" (Removes the 'Completed' checkmark)
		// Note: Some LMSs prefer "not attempted", but "incomplete" is safer while the window is open.
		this._set("cmi.core.lesson_status", "incomplete");

		// 3. Wipe the Score
		this._set("cmi.core.score.raw", "");
		this._set("cmi.core.score.max", "");
		this._set("cmi.core.score.min", "");

		// 4. Clear the "Exit" state so the LMS doesn't try to resume next time
		this._set("cmi.core.exit", "");

		// 5. Force the LMS to save these changes immediately
		return this._commit();
	},

	getStudentName: function() {
		return pipwerks.SCORM.get("cmi.core.student_name");
	},

	saveData: function(data){
		// cmi.suspend_data limit is ~4096 chars
		if(this._dataOverLimit(data, this._saveLimit)){ // check data size and truncate
			return false;
		}
		let success = this._set("cmi.suspend_data", data);
		if(success) this._commit();
		return success;
	},

	loadData: function(){
			return pipwerks.SCORM.get("cmi.suspend_data");
	},

	setScore: function(score, maxScore){
		// SCORM 1.2 expects an int (percent), not a float
		// Input: 0.85, 1.0 -> Output: 85
		let raw = Math.round((score / maxScore) * 100);
		this._set("cmi.core.score.raw", raw);
		this._set("cmi.core.score.max", 100);
		this._set("cmi.core.score.min", 0);
		this._commit();
	},

	setStatus: function(status){
		// SCORM 1.2 uses cmi.core.lesson_status
		// Valid values: "passed", "completed", "failed", "incomplete", "browsed", "not attempted"
		if(!this._validStatusValues.includes(status)){
			console.error(`Invalid Lesson Status '${status}'. Valid Status --> `, this._validStatusValues);
			return false;
		}
		let success = this._set("cmi.core.lesson_status", status);
		if(success) this._commit();
		return success;
	},

	quit: function(){
		pipwerks.SCORM.quit();
		console.log("Disconnected from the LMS");
	}
};

let LocalStorageAdapter = {
	// Adapter for running without an LMS (Standalone Mode)
	name: "Local Storage",
	initialized: false,

	// --- Private Properties ---
	_prefix: "course_data_", // Helps avoid conflicts with other websites

	// --- Private Methods ---
	_log: function(msg){
		console.log(`[${this.name}] ${msg}`);
	},

	_set: function(key, value){
		try {
			localStorage.setItem(this._prefix + key, value);
		} catch(e) {
			console.error(e);
			return false;
		}
		return true;
	},

	// --- PUBLIC API ---
	init: function(){
		this.initialized = true;
	},

	reset: function(){
		this._log("Clearing all saved data");
		Object.keys(localStorage).forEach(k => {
			if(k.startsWith(this._prefix)){
					localStorage.removeItem(k);
			}
		});
	},

	getStudentName: function() {
		return "";
	},

	saveData: function(data){
		this._log("Saving data to local browser storage...");
		return this._set("suspend_data", data);
	},

	loadData: function(){
		this._log("Loading data...");
		return localStorage.getItem(this._prefix + "suspend_data");
	},

	setScore: function(score, maxScore){
		this._log(`Setting Score: ${score}/${maxScore}`);
		this._set("score", score);
	},

	setStatus: function(status){
		this._log(`Setting Status: ${status}`);
		this._set("status", status);
		return true;
	},

	quit: function(){
		this._log("Session ended");
	}
};

// --- End of Objects ---

window.onload = async () => {
	lms.init();
	await state.loadCourseData();
	state.loadSave();
	state.init("lesson-frame", "info-banner");
	window.addEventListener('message', state.handleMessage.bind(state));
};

window.onbeforeunload = () => {
	if(!state.data.pages || state.data.pages.length === 0){
		console.log("pages not loaded");
		state.save();
		return;
	}
	state.save();
	if(!state.data.pages[state.data.currentPageIndex].completed){
		return "Your progress on the current page my be lost.";
	}
};

window.onunload = () => {
	lms.quit();
};

function test(){
	state.infoBanner.innerHTML = "<p>Please complete all items on the page</p>";
	state.infoBanner.style.display = "block";
	state.save();
}
