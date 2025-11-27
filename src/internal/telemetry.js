let telemetry = {
	/* Takes in data, encodes, and decodes, and translates */
	_delimiter: '^',
	_supportsCompression: false,
	_useCompression: false,
	_compressionPrefix: "CGZ", //how we can tell the data is compressed. the string starts with CGZ
	_logDelimiter: '~',
	_version: "v1",
	_startTime: null,
	_eventBuffer: [], //logs that have not been saved yet

	// Data structure: Version ^ UserID ^ SessionStart ^ [Delta_Data] ^ [Interaction_Log]

	init: function(){
		/* Sets _startTime = Date.now(). Clears the _eventBuffer. Called when the course loads. */
		this._startTime = Date.now();
		this._eventBuffer = [];
		this._supportsCompression = (typeof CompressionStream != 'undefined');
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
		const encoder = new TextEncoder();
		const cs = new CompressionStream('gzip'); // or 'deflate'
		const writer = cs.writable.getWriter();
		writer.write(encoder.encode(str));
		writer.close();
		const compressed = await new Response(cs.readable).arrayBuffer();
		return this._uint8ToBase64(new Uint8Array(compressed));
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
		return(this._toBase36(offsetS));
	},

	// --- Public API ---

	log: function(action, value){
		/* The Main Recorder. Accepts a code (e.g., "NAV") and a value (e.g., "2"). Automatically calculates the time offset and pushes the compressed string to the buffer. */
		const timeStamp = this._getOffest();
		const message = `${timeStamp},${action},${value}`;
		this._eventBuffer.push(message);
		console.log(`encoder.log --> '${message}'`);
	},

	pack: async function(deltaArray){
		/* The Serializer. Accepts your specific array of state data (Progress, Score, etc.). Joins Version, UserID, StartTime, DeltaArray, and _eventBuffer into one long string for the LMS.
		TODO handle no compression of data */
		const raw = [
				this._version,
				this._userID,
				this._toBase36(this._startTime),
				...deltaArray.map(d => this._toBase36(d)), // Convert all deltas to Base36 to save space
				this._eventBuffer.join(this._logDelimiter)
		].join(this._delimiter);

		// 2. Compress
		const compressed = await this._compressGzip(raw);
		return compressed;
	},

	unpack: async function(saveString){
		/* The Deserializer. Takes the raw string from the LMS, splits it by ^, decodes the numbers, and returns a clean object { state: [], log: [] } for your app to load.
		 TODO handle non-compressed data */

		if (!saveString) return null;
		let raw = "";
		try {
				// 1. Decompress (Await the promise directly)
				// Check if it looks like Gzip (starts with H4s... usually) or if you used a prefix
				// For now, assuming all input is Gzip compressed as per your pack method
				raw = await this._decompressGzip(saveString);
		} catch (e) {
				console.error("Decompression failed. Data might be corrupt or uncompressed.", e);
				return null;
		}

		// 2. Split by Delimiter (^)
		const parts = raw.split(this._delimiter);

		// Safety Check: Ensure we have enough parts
		if(parts.length < 4){
				console.error("Save data format invalid.");
				return null;
		}

		// 3. Map the Parts (Based on your pack structure)
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

		// 4. Process Delta (Base36 -> Numbers)
		const deltaArray = deltaRaw.map(val => this._fromBase36(val));

		// 5. Process Log (Split by ~)
		const logArray = logRaw.length > 0 ? logRaw.split(this._logDelimiter) : [];

		// 6. Return the clean object
		return {
				meta: {
						version: version,
						userID: userID,
						startTime: startTime
				},
				delta: deltaArray,
				log: logArray
		};
	},

	getHumanTime: function(offset){
		/* Debug Helper. Converts a raw timestamp (or calculated offset) into a human-readable string (e.g., "10:45 AM") for your console logs or analytics viewer. */
		const date = new Date(this._startTime + offset * 1000);
		return (date.toUTCString());

	},
}
