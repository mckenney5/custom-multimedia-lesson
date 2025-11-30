let telemetry = {
	/* Takes in data, encodes, and decodes, and translates */
	_delimiter: '^',
	_supportsCompression: false,
	_useCompression: true,
	_compressionPrefix: "CGZ", //how we can tell the data is compressed. the string starts with CGZ
	_logDelimiter: '~',
	_logHeadDelimiter: '`',
	_version: "v1",
	_startTime: null,
	_eventBuffer: [], //logs that have not been saved yet
	_currentLog: [], //the complete log
	_userID: "",

	_encoding: {
		"COURSE_COMPLETE" : "0",
		"PAGE_COMPLETE" : "1",
		"COURSE_LOADED" : "2",
		"STARTED_NEW_COURSE" : "3",
		"QUIZ_SUBMITTED" : "4",
		"QUESTIONS_RENDERED" : "5",
		"GENERAL" : "6",
		"SCROLLED" : "7",
		"PAGE_NEXT" : "8",
		"PAGE_PREV" : "9",
		"VIDEO_PLAY" : "a",
		"VIDEO_PAUSE" : "b",
		"VIDEO_FORWARD" : "c",
		"VIDEO_REWIND" : "d",
		"VIDEO_SPEED_CHANGE" : "e",
		"VIDEO_FULL_SCREEN" : "f",
		"VIDEO_NORMAL_SCREEN" : "g",
		"VIDEO_PROGRESS" : "h",
		"VIDEO_HEARTBEAT" : "i",
		"VISIBILITY_HIDDEN": "j",
		"VISIBILITY_VISIBLE" : "k",
		"USER_IDLE" : "l",
		"USER_ACTIVE" : "m",
		"DIAGNOSTIC" : "n",
		"VIDEO_MUTED" : "o",
		"CLICK_OFF" : "p",
		"CLICK_BACK" : "q"
	},

	_decoding: {
		"0": "COURSE_COMPLETE",
		"1": "PAGE_COMPLETE",
		"2": "COURSE_LOADED",
		"3": "STARTED_NEW_COURSE",
		"4": "QUIZ_SUBMITTED",
		"5": "QUESTIONS_RENDERED",
		"6": "GENERAL",
		"7": "SCROLLED",
		"8": "PAGE_NEXT",
		"9": "PAGE_PREV",
		"a": "VIDEO_PLAY",
		"b": "VIDEO_PAUSE",
		"c": "VIDEO_FORWARD",
		"d": "VIDEO_REWIND",
		"e": "VIDEO_SPEED_CHANGE",
		"f": "VIDEO_FULL_SCREEN",
		"g": "VIDEO_NORMAL_SCREEN",
		"h": "VIDEO_PROGRESS",
		"i": "VIDEO_HEARTBEAT",
		"j": "VISIBILITY_HIDDEN",
		"k": "VISIBILITY_VISIBLE",
		"l": "USER_IDLE",
		"m": "USER_ACTIVE",
		"n": "DIAGNOSTIC",
		"o": "VIDEO_MUTED",
		"p": "CLICK_OFF",
		"q": "CLICK_BACK"
	},

	initialized: false,
	videoProgressInterval: 5, // <-- request that video progress be updated every 5%

	// Data structure: Version ^ UserID ^ SessionStart ^ [Delta_Data] ^ [Interaction_Log]

	init: function(){
		/* Sets _startTime = Date.now(). Clears the _eventBuffer. Called when the course loads. */
		this._startTime = Date.now();
		this._eventBuffer = [];
		this._supportsCompression = (typeof CompressionStream != 'undefined');
		this.initialized = true;
	},

	_toBase36: function(num){
		return Number.isInteger(num) ? num.toString(36) : String(num);
	},

	_fromBase36: function(str){
		return parseInt(String(str), 36);
	},

	_uint8ToBase64: function(u8){
		// chunk to avoid call stack limits for very large arrays
		let CHUNK = 0x8000;
		let index = 0;
		let res = '';
		while (index < u8.length) {
			let slice = u8.subarray(index, Math.min(index + CHUNK, u8.length));
			res += String.fromCharCode.apply(null, slice);
			index += CHUNK;
		}
		return btoa(res);
	},

	_base64ToUint8: function(b64){
		const binary = atob(b64);
		const u8 = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
		return u8;
	},

	_compressGzip: async function(str){
		try {
			const encoder = new TextEncoder();
			const cs = new CompressionStream('gzip'); // or 'deflate'
			const writer = cs.writable.getWriter();
			writer.write(encoder.encode(str));
			writer.close();
			const compressed = await new Response(cs.readable).arrayBuffer();
			return this._uint8ToBase64(new Uint8Array(compressed));
		} catch (e) {
			console.error(`telemetry._compressGzip: error while compressing '${str}' --> ${e}`);
			return "";
		}
	},

	_decompressGzip: async function(b64){
		const compressed = this._base64ToUint8(b64);
		const ds = new DecompressionStream('gzip');
		const writable = ds.writable.getWriter();
		writable.write(compressed);
		writable.close();
		const decompressed = await new Response(ds.readable).arrayBuffer();
		return new TextDecoder().decode(decompressed);
	},

	_getOffest: function(){
		/* Calculates Date.now() - _startTime, converts it to seconds, and returns it as a Base36 string. Used for logging timestamps. */
		const offsetMS = Date.now() - this._startTime;
		const offsetS = Math.floor(offsetMS/1000);
		return offsetS;
	},

	// --- Public API ---

	log: function(action, value){
		/* The Main Recorder. Accepts a code (e.g., "NAV") and a value (e.g., "2"). Automatically calculates the time offset and pushes the compressed string to the buffer. */
		const timeStamp = this._toBase36(this._getOffest());
		const encoded = this._encoding[action];

		// convert the object
		const v = (typeof value === "object") ? JSON.stringify(value) : String(value);

		//If the encoding is wrong, log it for examination
		const message = encoded ? `${timeStamp},${encoded},${v}` :
			`${timeStamp},${this._encoding["DIAGNOSTIC"]}, Unknown action '${action}' ${v}`;

		this._eventBuffer.push(message);
		console.log(`encoder.log --> '${message}'`);
	},

	report: function(userID, log, sessionStart){
		/* takes in a string, splits, decodes, and returns a list of events */
		const heading = ["ID", "Time Stamp", "Event", "Page Index", "Details"];
		const baseTime = sessionStart || this._startTime;
		this.startTime = baseTime; //if we are running in stand alone, we need a time ref
		// TODO calculate start time from the first log entry, that entry should contain the unix time

		const rows = log.map(r => {
			// make the row a list
			const list = r.split(',');

			// calculate time from offset
			const offset = this._fromBase36(list[0]);
			const time = this.getHumanTime(offset);

			// decode event
			const eventName = this._decoding[list[1]] || "UNKNOWN_EVENT";

			// page index (0 usually directions, last usually a congrats)
			const page = list[2];

			// combine the rest of the details
			const details = list.slice(3).join(',');

			return [userID, time, eventName, page, details];

		});

		const csv = [heading, ...rows];
		return csv;
	},

	exportCSV: function(csv){
		// takes in a 2D array formatted as a CSV and saves it

		// puts the text together
		const text = '\uFEFF' + csv.join("\n");

		// makes the html blob
		const blob = new Blob([text], {type: 'text/plain;charset=utf-8'});
		const url = URL.createObjectURL(blob);

		// runs the download code
		const a = document.createElement('a');
		a.href = url;
		a.download = `${this._userID}.data.csv`;
		document.body.appendChild(a); // needed in some browsers
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	},

	sanitize: function(str){
		// Removes delimiters from the string
		// Currently replaces them with nothing
		const filter = [this._delimiter, this._logDelimiter, this._logHeadDelimiter];

		let clean = "";
		for(let i = 0; i < str.length; i++){
			if(!filter.includes(str[i])){
				clean += str[i];
			}
		}
		return clean;
	},

	pack: async function(deltaArray){
		/* The Serializer. Accepts the specific array of state data (Progress, Score, etc.).
		 Joins Version, UserID, StartTime, DeltaArray, and _eventBuffer into one long string for the LMS. */
		const raw = [
				this._version,
				this._userID,
				this._toBase36(this._startTime),
				...deltaArray.map(d => typeof d === "number" ? this._toBase36(d) : d), // Convert all deltas to Base36 to save space, or keep as string
				this._eventBuffer.join(this._logDelimiter)
		].join(this._delimiter);

		// 2. Compress
		let compressed = "";

		if(this._supportsCompression && this._useCompression){
			compressed = this._compressionPrefix +  await this._compressGzip(raw);
		}
		// If compression fails (like no support), send the raw encoding instead
		return compressed ? compressed : raw;
	},

	unpack: async function(saveString){
		/* The Deserializer. Takes the raw string from the LMS, splits it by ^,
		 decodes the numbers, and returns a clean object { state: [], log: [] } for the app to load. */

		if (!saveString) return null;

		if(saveString.startsWith(this._compressionPrefix) && !this._supportsCompression){
			//if the user started this course on a modern browser but loaded progress on an old one...
			const reset = state.alert("IMPORTANT: Your progress cannot be reloaded on this browser. Continuing will wipe your progress. Are you sure you want to RESTART THE COURSE?");
			if(!reset){
				state.lockDown();
				return null;
			}
		}

		let raw = "";
		try {
				if((this._supportsCompression && this._useCompression) || saveString.startsWith(this._compressionPrefix)){
					raw = await this._decompressGzip(saveString.slice(this._compressionPrefix.length)); // <-- remove the compression prefix and decompress
				} else {
					raw = saveString;
				}
		} catch (e) {
				if(saveString.startsWith(this._version + this._delimiter)){
					console.log("User can do compression but saved without it");
					raw = saveString;
				} else {
					console.error(`telemetry.unpack: Decompression failed. Data might be corrupt! saveString: '${saveString}'\n`, e);
					return null;
				}
		}

		// 2. Split by Delimiter (^)
		const parts = raw.split(this._delimiter);

		// Safety Check: Ensure we have enough parts
		if(parts.length < 4 || parts[0] !== this._version){
				console.log(`[DEBUG]telemetry.unpack --> Saved data invalid: '${raw}'`);
				return null;
		}

		// 3. Map the Parts (Based on the pack structure)
		// Structure: Version ^ UserID ^ StartTime ^ [Delta...Delta] ^ [Log...Log]

		// Index 0: Version
		const version = parts[0];

		// Index 1: UserID
		const userID = parts[1];

		// Index 2: StartTime (Base36 -> Int)
		const startTime = this._fromBase36(parts[2]);

		// Index 3 to N-1: The Delta Array
		// We know the Log is the *last* item. Everything between StartTime and Log is Delta.
		const logRaw = parts[parts.length - 1];
		const deltaRaw = parts.slice(3, parts.length - 1);

		// 4. Process Delta (Base36 -> Numbers or keep it if its a string)
		const deltaArray = deltaRaw.map(val => {
			const decoded = this._fromBase36(val);
			return isNaN(decoded) ? val : decoded;
		});

		// 5. Process Log (Split by ~)
		const logArray = logRaw.length > 0 ? logRaw.split(this._logDelimiter) : [];

		// 6. Return the clean object
		const cleanObject = {
				meta: {
						version: version,
						userID: userID,
						startTime: startTime
				},
				delta: deltaArray,
				log: logArray
		};
		console.log("[DEBUG] telemetry.unpack --> ", cleanObject);
		this._currentLog = cleanObject.log;
		this._userID = cleanObject.meta.userID;
		return cleanObject;
	},

	getHumanTime: function(offset){
		/* Debug Helper. Converts a raw timestamp (or calculated offset) into a human-readable string (e.g., "10:45 AM") for the console logs or analytics viewer. */
		const date = new Date(this._startTime + offset * 1000);
		return (date.toString());

	},
}
