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
	pauseSave: false, // Flag to pause the save on a reset
	test: null, // Used for debugging
	studentName: "",
	studentID: "",
	sessionStartTime: 0, // Logs how long the student has been on today
	isIdle: false, // Tracks if the user is idle on the site to help balance logs
	focusTimer: null, // handles timing between focus checks
	initialized: false,

	init: async function(frameId, bannerId, infoBar) {
		// Set up LMS connection
		if(!lms.initialized) lms.init();

		// Set the student's name
		this.studentName = lms.getStudentName().split(',')[1] || ""; // returns first name (Lastname,Firstname)

		// Set the student's ID
		this.studentID = lms.getStudentID();

		// Set up journaler
		if(!journaler.initialized) await journaler.init();

		// Set the date and time of us starting today. TODO consider not using the user for time
		this.sessionStartTime = Date.now();

		// finds the required iframe and banner
		this.lessonFrame = document.getElementById(frameId);
		this.infoBanner = document.getElementById(bannerId);
		this.infoBar = document.getElementById(infoBar);

		// attempt to load the course (static data)
		await this.loadCourseData();

		// attempt to load the saved state
		await this.loadSave();

		// load last webpage we were on
		this.lessonFrame.src = this.data.pages[this.data.delta.currentPageIndex].path;

		// start event listeners and timers
		this.startEventListeners();

		// update the UI bar
		this.updateInfo();

		// mark done
		this.initialized = true;
	},

	startEventListeners: function(){

		// make infoBanner close on click
		this.infoBanner.addEventListener("click", () => {this.infoBanner.style.display = "none"});

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
				const childWindow = this.lessonFrame.contentWindow;
				childWindow.addEventListener("focus", onFocus);
				childWindow.addEventListener("blur", onBlur);
				childWindow.document.addEventListener("click", onFocus);

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
			if(++this.data.delta.totalCourseSeconds % 60 == 0){
				if(!debugging) this.save();
			}
			const page = this.data.delta.pagesState[this.data.delta.currentPageIndex];
			page.watchTime += 1;
			this.finalizePage();

		}, 1000);

	},

	serialize: function(){
		// Takes in the delta and flattens the array
		// NOTE: Rounds numbers
		const delta = this.data.delta;
		let data = [
			delta.currentPageIndex,
			delta.progress,
			delta.totalCourseSeconds
		];

		// This code must be specific. It was originally converting objects into values and using a switch statement to encode
		// This cannot work because in 'Object.values(obj)' there is NO guarantee that it will be in order...
		delta.pagesState.slice().forEach(p => {
			//push each hardcoded key value into the data list

			// Simple round to two decimal points, and make it an int (we will make it a float again in deserialize)
			const roundFloatTo2Int = n => Math.round(n*100);

			data.push(p.completed ? 1: 0);
			data.push(p.scrolled ? 1: 0);
			data.push(roundFloatTo2Int(p.score));
			data.push(p.watchTime); //TODO see if rounding is needed
			data.push(p.attempts);
			data.push(roundFloatTo2Int(p.videoProgress));

			// Convert user answers to a string and sanitize it
			data.push(journaler.sanitize(JSON.stringify(p.userAnswers || {})));

		});

		return data; // <-- an array of mostly numbers
	},

	deserialize: function(arr){
		/*
		 Logic: Take the array from journaler.unpack. Read indices 0-2 into the global variables.
		 Loop through the rest of the array (in chunks based on the page schema size) and assign values back to this.data.delta.pagesState.
		*/
		const delta = this.data.delta;
		delta.currentPageIndex = arr[0];
		delta.progress = arr[1];
		delta.totalCourseSeconds = arr[2];

		const GLOBALS_COUNT = 3;
		const ITEMS_PER_PAGE = 7;

		delta.pagesState = delta.pagesState.map((p, i) => {
			// Reconstruct the object
			// math to calculate offsets
			let base = GLOBALS_COUNT + (i * ITEMS_PER_PAGE);

			// check array size to stop trying to read past the array
			if(base >= arr.length) return p;

			return {
				completed: (arr[base + 0] === 1),
				scrolled: (arr[base + 1] === 1),
				score: arr[base + 2]/100, // <-- convert back to float
				watchTime: arr[base + 3],
				attempts: arr[base + 4],
				videoProgress: arr[base + 5]/100, // <-- convert back to float
				userAnswers: JSON.parse(arr[base + 6] || "{}")
			};
		});

	},

	updateInfo: function (){
		// updates the info bar on the bottom of the UI
		const currentPage = this.data.delta.currentPageIndex+1;
		const pageCount = this.data.pages.length;
		const progress = Math.round((this.data.delta.progress/(this.data.pages.length-1))*100);

		this.infoBar.innerHTML = `<p>Page: ${currentPage}/${pageCount} (${progress}%)</p>`;
	},

	handleLastPage: function(){
		if(this.checkCourseCompletion()){
			// if all the course rules are met

			// Calculate score
			const grade = this.calculateOverallGrade();
			const gradeString = String(grade.ratio * 100); // <-- percentage grade as a string
			journaler.log("COURSE_COMPLETE", gradeString);
			journaler.transmit("FINAL", journaler.report().join("\n"), true); // <-- send final data, send expanded analytics as a CSV, high priority

			lms.setScore(grade.earnedScore, grade.maxScore); // <-- send course score to the LMS

			const minimumGrade = this.data.courseRules.minimumGrade;
			const completeOnly = this.data.courseRules.completeOnly;
			const studentsCanFail = this.data.courseRules.studentsCanFail;

			if(completeOnly){
				lms.setStatus("completed");
			} else if(studentsCanFail){
				if(grade.ratio < minimumGrade){
					lms.setStatus("failed");
				} else {
					lms.setStatus("passed");
				}
			} else {
				// we made it to the end and the student did not do well enough
				// break the sad news, restart the course
				alert(`You did not score high enough (you got a ${gradeString}% and needed a ${grade.ratio * 100}%). Click okay to retry`);
				this.reset(); // TODO find a nicer way to do this and probably log attempts, like a soft reset
			}

			// Show the last page
			this.data.delta.currentPageIndex = this.data.pages.length -1 ;
			this.lessonFrame.src = this.data.pages[this.data.delta.currentPageIndex].path;
			return true;
		} else {
			return false;
		}
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
		// Can you tell I had so many off by one bugs?
		const lastPage = this.data.pages.length-1;
		const secondToLastPage = lastPage -1;
		const currentPage = this.data.delta.currentPageIndex

		if(currentPage === secondToLastPage){
			// see if we can finish the course
			if(this.checkCourseCompletion()){
				this.handleLastPage();
			} else {
				this.bannerMessage("You have not finished all course requirements. Review your work and try again");
			}
		} else if(currentPage === lastPage){
			// Do nothing. We are at the end of the pages
		} else {
			// if the next page is just another page
			this.data.delta.currentPageIndex += 1;
			this.lessonFrame.src = this.data.pages[this.data.delta.currentPageIndex].path;
		}
	},

	next: function() {
		if(this.initialized === false){
			console.error("Cannot go to next page until the state is initialized. Run state.init() first");
			return false;
		}
		this.infoBanner.style.display = ""; //reset banner

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

		let saveData = this.serialize();

		let compressed = await journaler.pack(saveData);

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

	lockDown: function(){
		//Stops saving and disables the course
		this.pauseSave = true;

		// disable buttons
		document.querySelectorAll('button').forEach(btn => btn.disabled = true);

		//clear the screen
		this.lessonFrame.src = "about:blank";

		// quit
		this.quit();

		// Inform the user
		window.document.body.innerHTML = "<h2>Course disabled</h2>"

		// remove event listeners
		window.onbeforeunload = () => console.log("Stoping prompt");
		window.onunload = () => console.log("Stoping quit");

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

		return (
			pageDelta.watchTime >= page.completionRules.watchTime &&
			score >= page.completionRules.score &&
			pageDelta.scrolled === page.completionRules.scrolled &&
			pageDelta.videoProgress >= page.completionRules.videoProgress
		)
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

		switch(event.data.type){
			case "QUIZ_SUBMITTED":
				journaler.log("QUIZ_SUBMITTED", index);
				pageDelta.userAnswers = event.data.message; // <-- push what the user says to the state of the page
				const grades = this.gradeQuizQuestions(page.questions, event.data.message);
				pageDelta.score = grades.score;
				this.finalizePage(); // <-- do a page completion check
				this.lessonFrame.contentWindow.postMessage({ type: "QUIZ_INFO",
					score: pageDelta.score / page.maxScore,
					maxAttempts: page.completionRules.attempts - ++pageDelta.attempts },
					'*');
				break;

			case "QUIZ_ADD_QUESTIONS":
				// Page requests the quiz to be rendered from the JSON, and gets the rendered HTML returned
				this.lessonFrame.contentWindow.postMessage({ type: "QUIZ_ADD_QUESTIONS",
					message: this.renderQuiz(this.data.delta.currentPageIndex)}, '*');
				journaler.log("QUESTIONS_RENDERED", index);
				break;

			case "LOG":
				journaler.log("GENERAL", `${index} ${event.data.message}`);
				break;

			case "PAGE_SCROLLED":
				pageDelta.scrolled = event.data.scrolled;
				journaler.log("SCROLLED", index);
				break;

			case "VIDEO_PROGRESS":
				pageDelta.videoProgress = event.data.message;
				//log progress every 5%
				if(Math.round(event.data.message * 100) % journaler.videoProgressInterval === 0) journaler.log("VIDEO_PROGRESS", `${index},${roundTo4(pageDelta.videoProgress)}`);
				break;

			case "VIDEO_PLAYING":
				// Logs when the play button was hit, and video percentage at that point
				journaler.log("VIDEO_PLAY", `${index},${roundTo4(pageDelta.videoProgress)}`);
				break;

			case "VIDEO_PAUSED":
				journaler.log("VIDEO_PAUSE", `${index},${roundTo4(pageDelta.videoProgress)}`);
				break;

			case "VIDEO_REWIND":
				// TODO look into better way of getting rewind to and from
				journaler.log("VIDEO_REWIND", `${index},${roundTo4(pageDelta.videoProgress)}`);
				break;

			case "VIDEO_FORWARD":
				// TODO look into better way of getting forward to and from
				journaler.log("VIDEO_FORWARD", `${index},${roundTo4(pageDelta.videoProgress)}`);
				break;

			case "VIDEO_SPEED_CHANGE":
				journaler.log("VIDEO_SPEED_CHANGE", `${index},${roundTo4(pageDelta.videoProgress)},${event.data.message}`);
				break;

			case "VIDEO_FULL_SCREEN":
				journaler.log("VIDEO_FULL_SCREEN", `${index},${roundTo4(pageDelta.videoProgress)}`);
				break;

			case "VIDEO_NORMAL_SCREEN":
				journaler.log("VIDEO_NORMAL_SCREEN", `${index},${roundTo4(pageDelta.videoProgress)}`);
				break;

			case "VIDEO_MUTED":
				journaler.log("VIDEO_MUTED", `${index},${roundTo4(pageDelta.videoProgress)},${event.data.message}`);
				break;

			case "GET_STUDENT_DATA":
				// Returns name and current grade so far
				const grade = String(Math.floor((this.calculateOverallGrade().ratio * 100)));
				this.lessonFrame.contentWindow.postMessage({ type: "GET_STUDENT_DATA",
					name: this.studentName, grade: grade }, '*');
				journaler.log("GENERAL", "student info requested, page " + String(index));
				break;

			default:
				console.error(`${name}: Unknown / unimplemented message! --> ${event}`);
				break;
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
		journaler.log("GENERAL", message);
	},

	alert: function(message){
		//handles critical alerts to the user. useful if the calling object does not need a DOM
		return confirm(message);
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
			console.error("state.gradeQuizQuestions: Max score set too low --> ", maxScore);
			return -1;
		}
		return ({score: score, maxScore: maxScore});
	},

	renderQuiz: function(index){
		// Puts all of the questions on the screen, in their own DIV
		let QUIZ_QUESTIONS = this.data.pages[index].questions;
		let savedAnswers = this.data.delta.pagesState[index].userAnswers;

		let html = "";

		// add feedback div to show submission and test score
		html += '<div id="feedback" style="display: none; margin-top: 20px;"><p>Your answer has been submitted to the LMS.</p></div>';

		for(let i = 0; i < QUIZ_QUESTIONS.length; i++){
		// Render every question in a div
			let qID = QUIZ_QUESTIONS[i].id;

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
				let val = QUIZ_QUESTIONS[i].possibleAnswers[l];

				let isChecked = "";
				if(savedAnswers && savedAnswers[qID] && savedAnswers[qID].includes(val)){
					isChecked = "checked";
				}

				html += `
					<input id="a${l}" type="checkbox" value="${val}" ${isChecked}>
					<label id="a${l}-label" for="a${l}">${val}</label>
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
		/* Sets up the state of the program
		 * Loads and sets up static data objects
		 * Loads and sets up dynamic data objects
		 */
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
			console.log("Loaded course_data.json");
			const rawData = await response.json();

			// Save course rules
			this.data.courseRules = rawData.courseRules || {};

			// Load the learning pages
			this.data.delta.pagesState = []; // <-- reset page states

			// Load the learning pages AND generate initial state
			this.data.pages = rawData.pages.map(page => {

			// Create state object
				const pageState = {
					completed: false,
					scrolled: false,
					score: 0.0,
					watchTime: 0,
					attempts: 0,
					videoProgress: 0.0,
					userAnswers: {}
				};
				this.data.delta.pagesState.push(pageState);

				// Return the Static Object
				return {
					...page, // id, name, type, questions
					path: `lessons/${page.name}`,
					maxScore: page.type === 'quiz'
							? page.questions.reduce((acc, q) => acc + q.pointValue, 0.0)
							: 0.0
				};

			});
		} catch(error){
			console.error("Failed to load course data: ", error);
		}
	}
};

// --- End of Objects ---

window.onload = async () => {

	// Write some loading text into the iframe
	const iframe = document.getElementById("lesson-frame");
	iframe.src = 'about:blank';
	const doc = iframe.contentDocument || iframe.contentWindow.document;
	doc.open();
	doc.write('<!doctype html><html lang="en">Loading…</html>');
	doc.close();

	// Start the web app
	await state.init("lesson-frame", "info-banner", "info-bar");
	window.addEventListener('message', state.handleMessage.bind(state));
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

function test(){
	state.infoBanner.innerHTML = "<p>Please complete all items on the page</p>";
	state.infoBanner.style.display = "block";
	state.save();
}
