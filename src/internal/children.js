// This script manages built-in pages

const child = {
	parentOrigin: null, //parent origin
	pageAPICode: null,
	pageType: null,
	messageQueue: [],
	messagePoller: null,

	events: {
		eventList: [], //holds event objects
		removeAll: function(){
			//loops through eventList and pops the eventListers
			this.eventList.forEach(e => this.remove(e.event, e.funcName));
			this.eventList = [];
		},

		remove: function(eventName, functionPtr){
			const index = this.eventList.findIndex(e => e.event === eventName &&
				e.funcName === functionPtr);
			if(index === -1){
				console.warn(`Could not remove event '${eventName}': Listener not found.`);
				return;
			}

			window.removeEventListener(eventName, this.eventList[index].handler);
			//remove it from the list
			this.eventList.splice(index, 1);
		},

		add: function(eventName, functionPtr, context){
			//adds the event listeners and pushes the names into eventList

			// context allows the passing of _this_ object
			const func = context ? functionPtr.bind(context) : functionPtr;

			// Add the event listener
			window.addEventListener(eventName, func);

			// Add to the list
			this.eventList.push({event: eventName, funcName: functionPtr, handler: func});
		},

		fire: function(subject, data){
			// sends out custom events
			const dataEvent = new CustomEvent(subject, {
				detail: data,
			});
			console.debug(`Firing event '${subject} --> '`, data);
			window.dispatchEvent(dataEvent);
		},
	},

	init: function() {
		window.child = this;
		if(this.messagePoller){
			clearInterval(this.messagePoller);
		}
		this.messagePoller = setInterval(() => {
			if(!this.pageAPICode || this.pageAPICode === "*") return;
			if(this.messageQueue.length > 0){
				// FIXED: Send m[2] (the ID)
				this.messageQueue.forEach(m => this.send(m[0], m[1], m[2]));
				this.messageQueue = [];
			}
			clearInterval(this.messagePoller);
		}, 100);

		// Set up handshake
		this.events.add("message", this.handShake, this);

		// Send handshake (cannot use send method since we do not know 'who' we are sending it to
		window.parent.postMessage({type: "ORIGIN", message: ""}, "*");
	},

	setup: function(){
		// set up events
		this.events.add("message", this.receive, this);

		// push to the body
		//this.send("SEND_RENDER", "");

		// request META Data
		this.send("SEND_META", "");


	},

	die: function(){
		//set the body to nothing
		document.body.innerHTML = "Loading...";
		//remove all events
		this.events.removeAll();
		//do handshake again
	},

	handShake: function(event){
		if(event.data.type === "ORIGIN" && event.origin === event.data.message){
			this.parentOrigin = event.origin;
			this.pageAPICode = event.data.code;
			this.events.remove("message", this.handShake);
			this.setup();
		} else {
			console.error("Handshake failed");
		}
	},


	send: function(subject, body, id = null, backoff = 0){
		if(!this.pageAPICode || this.pageAPICode === "*"){
			this.messageQueue.push([subject, body, id]);
			this._lastSent = { subject, body, id, nonce: Date.now(), retries: 0 };
			return;
		}

		this._nonceCounter = ((this._nonceCounter || 0) + 1) % 10000;
		const nonce = Date.now() - (this._nonceCounter / 1000);
		const message = {
			type: subject,
			message: body,
			code: this.pageAPICode,
			nonce: nonce,
		};

		// Only include id if it's not null or undefined
		if(id !== null && id !== undefined){
			message.id = id;
		}

		this._lastSent = { subject, body, id, nonce, retries: 0 };

		window.parent.postMessage(message, this.parentOrigin);
	},

	receive: function(event){
		const subject = event.data.type;
		const message = event.data.message;
		const id = event.data.id; // <-- Capture the ID from Parent
		console.debug(`Child: recieved '${subject}'\n `, event);

		if (event.origin === "null") return;

		if(event.origin !== this.parentOrigin){
			console.error("Blocked message --> ", event);
			return;
		}

		// Helper to inject ID into the message object so components can read it
		if(id && typeof message === "object" && message !== null){
			message._targetId = id;
		}

		switch(subject){
			case "PING":
				console.debug("PONG");
				this.send("PONG", message);
				break;
			case "SEND_META":
				this.events.fire("meta-information", message);
				break;
			case "GET_STUDENT_DATA":
				const data = {
					name: message.name,
					grade: message.grade,
				};
				this.events.fire("student-data", data);
				break;
			case "GET_QUIZ_DATA":
				this.events.fire("quiz-data", message);
				break;
			case "QUIZ_DATA":
				this.events.fire("quiz-data", message);
				break;
			case "QUIZ_RESULTS":
				this.events.fire("quiz-results", message);
				break;
			case "SET_THEME":
				document.documentElement.setAttribute("data-theme", message);
				break;
			case "PROGRAMMING_DATA":
				this.events.fire("programming-data", message);
				break;
			case "NONCE_REJECTED":
				if(!this._lastSent) break;
				if(this._lastSent.nonce !== event.data.nonce) break;

				const retryCount = (this._lastSent.retries || 0) + 1;
				if(retryCount > 3){
					console.error("Nonce retry exhausted, dropping message");
					this._lastSent = null;
					break;
				}

				const backoff = retryCount * 10;
				const oldSubject = this._lastSent.subject;
				const oldBody = this._lastSent.body;
				const oldId = this._lastSent.id;

				this.send(oldSubject, oldBody, oldId, backoff);
				this._lastSent.retries = retryCount;
				break;
			default:
				console.error("Child: Unknown message from parent --> ", event);
				break;
		}

	},

};

child.init();
