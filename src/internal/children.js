// This script manages built-in pages

const child = {
	parentOrigin: null, //parent origin
	pageAPICode: null,
	pageType: null,

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
		}
	},

	init: function() {
		// Set up handshake
		this.events.add('message', this.handShake, this);

		// Send handshake (cannot use send method since we do not know 'who' we are sending it to
		window.parent.postMessage({type: 'ORIGIN', message: ""}, '*');
	},

	setup: function(){
		// set up events
		this.events.add('message', this.recieve, this);

		// push to the body
		this.send("SEND_RENDER", "");

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
			this.events.remove('message', this.handShake);
			this.setup();
		} else {
			console.error("Handshake failed");
		}
	},

	send: function(subject, body){
		window.parent.postMessage({type: subject, message: body, code: this.pageAPICode}, this.parentOrigin);
	},

	recieve: function(event){
		const subject = event.data.type;
		const message = event.data.message;

		if(event.origin !== this.parentOrigin){
			console.error("Blocked message --> ", event);
			return;
		}

		switch(subject){
			case "PING":
				console.log("PONG");
				this.send("PONG", message);
				break;
			case "SEND_RENDER":
				document.body.innerHTML = message;
				break;
			case "SEND_META":
				this.pageType = message;
				break;
			default:
				console.error("Unknown message from parent --> ", event);
				break;
		}

	}

}

child.init();
