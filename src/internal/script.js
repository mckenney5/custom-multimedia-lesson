const debugging = true;
let state = {
	// --- Properties (Data) ---
	data: {
		pages: [],
		currentPageIndex: 0,
		progress: 0, // Sets the furthest we have been
		totalCourseSeconds: 0,
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
	sessionStartTime: 0, // Logs how long the student has been on today
	initialized: false,

	init: function(frameId, bannerId, infoBar) {
		// Set up LMS connection
		if(!lms.initialized) lms.init();

		// Set the students name
		this.studentName = lms.getStudentName().split(',')[1] || ""; // returns first name

		// Set the date and time of us starting today. TODO consider not using the user for time
		this.sessionStartTime = Date.now();

		// finds the required iframe and banner
		this.lessonFrame = document.getElementById(frameId);
		this.infoBanner = document.getElementById(bannerId);
		this.infoBanner.addEventListener("click", () => {this.infoBanner.style.display = "none"});
		this.infoBar = document.getElementById(infoBar);

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
		this.updateInfo();
		this.initialized = true;
	},

	updateInfo: function (){
		// updates the info bar on the bottom of the UI
		const currentPage = this.data.currentPageIndex+1;
		const pageCount = this.data.pages.length;
		const progress = Math.round((this.data.progress/(this.data.pages.length-1))*100);

		this.infoBar.innerHTML = `<p>Page: ${currentPage}/${pageCount} (${progress}%)</p>`;
	},

	handleLastPage: function(){
		if(this.checkCourseCompletion()){
			// if all the course rules are met

			// Update user progress
			//this.data.progress = this.data.pages.length;

			// Calculate score
			const grade = this.calculateOverallGrade();
			const gradeString = String(grade.ratio * 100); // <-- percentage grade as a string
			this.log("Course finished with a Grade of " + gradeString);

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
				this.reset(); // TODO find a nicer way to do this and probably log attempts
			}

			// Show the last page
			this.data.currentPageIndex = this.data.pages.length -1 ;
			this.lessonFrame.src = this.data.pages[this.data.currentPageIndex].path;
			return true;
		} else {
			return false;
		}
	},

	finalizePage: function(){
		const page = this.data.pages[this.data.currentPageIndex];
		if(this.checkIfComplete() && this.data.currentPageIndex === this.data.progress && page.completed === false){
			page.completed = true;
			this.data.progress += 1;
			this.save();
			this.log(`Page ${this.data.currentPageIndex} completed`);
			this.bannerMessage("This page is completed. You may continue", false);
		} else {
			return false;
		}
		return false;
	},

	advancePage: function(){
		// Can you tell I had so many off by one bugs?
		const lastPage = this.data.pages.length-1;
		const secondToLastPage = lastPage -1;
		const currentPage = this.data.currentPageIndex

		if(currentPage === secondToLastPage){
			// see if we can finish the course
			if(this.checkCourseCompletion()){
				this.handleLastPage();
			} else {
				this.bannerMessage("You have not finished all course requirements. Review your work and try again");
			}
		} else if(currentPage === lastPage){
			// recheck the final course completion
		} else {
			// if the next page is just another page
			this.data.currentPageIndex += 1;
			this.lessonFrame.src = this.data.pages[this.data.currentPageIndex].path;
		}
	},

	next: function() {
		if(this.initialized === false){
			console.error("Cannot go to next page until the state is initialized. Run state.init() first");
			return false;
		}
		this.infoBanner.style.display = ""; //reset banner

		const page = this.data.pages[this.data.currentPageIndex];

		if(this.checkIfComplete() && !page.completed){
			// if we just completed the page
			page.completed = true;
			this.log(`Page ${this.data.currentPageIndex} completed`);
			this.advancePage();
		} else if(page.completed) {
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
		this.data.currentPageIndex--;

		// Check if we are at the end
		if (this.data.currentPageIndex < 0) {
			this.bannerMessage("Cannot go back. You are on the first page");
			this.data.currentPageIndex = 0;
			return;
		}

		// Set the iframe source
		this.lessonFrame.src = this.data.pages[this.data.currentPageIndex].path;
		this.updateInfo();
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

	quit: function(){
		if(!this.sessionStartTime) return; // <-- if not initialized

		const sessionDuration = Date.now() - this.sessionStartTime;

		lms.setSessionTime(sessionDuration);

		lms.quit();
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

	calculateOverallGrade: function (){
		// Calculate score dynamically
		const earnedScore = this.data.pages.reduce((acc, p) => acc + p.score, 0); // <-- what the user earned
		const maxScore = this.data.pages.reduce((acc, p) => acc + p.maxScore, 0);
		return ({ratio: earnedScore / maxScore, earnedScore: earnedScore, maxScore: maxScore});
	},

	checkCourseCompletion: function(){
		const isTimeRequirementMet = (this.data.courseRules.minimumMinutes * 60) <= this.data.totalCourseSeconds;
		const isScoreMet = this.data.courseRules.minimumGrade <= this.calculateOverallGrade().ratio;
		const studentsCanFail = this.data.courseRules.studentsCanFail;

		if(isTimeRequirementMet && (isScoreMet || studentsCanFail)){
			this.data.pages[this.data.pages.length-1].completed = true;
			// set the good bye page to completed since the important course information is done
			// this also allows us to check all the other ones
		}
		const isEveryPageComplete = this.data.pages.every(p => p.completed);
		//return (isLastPage && isTimeRequirementMet && isScoreMet && isEveryPageComplete);
		return (isTimeRequirementMet && (isScoreMet || studentsCanFail) && isEveryPageComplete);
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
			const rawData = await response.json();

			// Save course rules
			this.data.courseRules = rawData.courseRules || {};

			// Load the learning pages
			this.data.pages = rawData.pages.map(page => ({
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

// --- End of Objects ---

window.onload = async () => {
	lms.init();
	await state.loadCourseData();
	state.loadSave();
	state.init("lesson-frame", "info-banner", "info-bar");
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
	// TODO handle this better with mobile
	// See: https://developer.mozilla.org/en-US/docs/Web/API/Window/unload_event
	state.quit();
};

function test(){
	state.infoBanner.innerHTML = "<p>Please complete all items on the page</p>";
	state.infoBanner.style.display = "block";
	state.save();
}
