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
				console.warn(`Could not remove event '${type}': Listener not found.`);
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
			console.log(`Firing event '${subject} --> '`, data);
			window.dispatchEvent(dataEvent);
		},
	},

	init: function() {
		// Make the object global
		window.child = this;

		// Set up a message Queue in case we cannot auth in time for page load
		this.messagePoller = setInterval(() => {
			if(!this.pageAPICode || this.pageAPICode === "*") return;

			if(this.messageQueue.length > 0){
				console.log(`child: clearing out queue of ${this.messageQueue.length}`);
				this.messageQueue.forEach(m => this.send(m[0], m[1]));
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


	send: function(subject, body){
		if(!this.pageAPICode || this.pageAPICode === "*"){
			console.log("Message Queued");
			this.messageQueue.push([subject, body]);
			return;
		}
		window.parent.postMessage({type: subject, message: body, code: this.pageAPICode}, this.parentOrigin);
	},

	receive: function(event){
		const subject = event.data.type;
		const message = event.data.message;
		console.log(`Child: recieved '${subject}'\n `, event);

		if(event.origin !== this.parentOrigin){
			console.error("Blocked message --> ", event);
			return;
		}

		switch(subject){
			case "PING":
				console.log("PONG");
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
			case "QUIZ_RESULTS":

				this.events.fire("quiz-results", message);
				break;
			default:
				console.error("Child: Unknown message from parent --> ", event);
				break;
		}

	},

};

child.init();
