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

	setSessionTime: function(ms){
		if(!this.initialized) return false;
		this.driver.setSessionTime(ms);
	},

	reset: function(){
		if(!this.initialized) return false;
		return this.driver.reset();
	},

	getStudentName: function(){
		if(!this.initialized) return false;
		return this.driver.getStudentName();
	},

	getStudentID: function(){
		if(!this.initialized) return false;
		return this.driver.getStudentID();
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
			console.error(`Save data of ${data.length} chars is over the limit of ${limit}! Save rejected.`);
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

	_formatTime: function(ms){
		// SCORM 1.2 requires HHHH:MM:SS.SS
		let totalSeconds = ms / 1000;
		let hh = Math.floor(totalSeconds / 3600);
		let mm = Math.floor((totalSeconds % 3600) / 60);
		let ss = (totalSeconds % 60).toFixed(2);

		if(hh < 1000) hh = "00" + hh;
		if(hh.length > 4) hh = hh.substr(hh.length - 4);
		if(mm < 10) mm = "0" + mm;
		if(ss < 10) ss = "0" + ss;

		return `${hh}:${mm}:${ss}`;
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

	setSessionTime: function(ms){
		this._set("cmi.core.session_time", this._formatTime(ms));
		// This is usually run before the quit function, so no commit here
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

	getStudentID: function() {
		return pipwerks.SCORM.get("cmi.core.student_id");
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

	setSessionTime: function(ms){
		this._set("Session Time", `${(ms/1000).toFixed(2)}s`);
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
		return "Student";
	},

	getStudentID: function() {
		return "0000";
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
