const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("CourseVideo event handlers", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
		await page.addScriptTag({ path: "../src/internal/components.js" });
	});

	test.afterEach(async () => {
		await page.close();
	});

	// --- PLAY / PAUSE BUTTON ---

	test("play button should call videoElem.play() when paused", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let playCalled = false;
			video.videoElem.play = () => { playCalled = true; return Promise.resolve(); };
			video.send = () => {};
			video.attachListeners();
			video.playBtn.click();
			return playCalled;
		});
		expect(result).toBe(true);
	});

	test("play button should call videoElem.pause() when playing", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let pauseCalled = false;
			video.videoElem.pause = () => { pauseCalled = true; };
			Object.defineProperty(video.videoElem, "paused", { get: () => false, configurable: true });
			video.send = () => {};
			video.attachListeners();
			video.playBtn.click();
			return pauseCalled;
		});
		expect(result).toBe(true);
	});

	test("video area click should call videoElem.play() when paused", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let playCalled = false;
			video.videoElem.play = () => { playCalled = true; return Promise.resolve(); };
			video.send = () => {};
			video.attachListeners();
			video.videoElem.click();
			return playCalled;
		});
		expect(result).toBe(true);
	});

	// --- PLAY EVENT ---

	test("play event should update play button UI to pause state", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("play"));
			return {
				ariaLabel: video.playBtn.getAttribute("aria-label"),
				title: video.playBtn.title,
			};
		});
		expect(result.ariaLabel).toBe("Pause");
		expect(result.title).toBe("Pause");
	});

	test("play event should send VIDEO_PLAYING analytics", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let sendType = null;
			video.send = (type) => { sendType = type; };
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("play"));
			return sendType;
		});
		expect(result).toBe("VIDEO_PLAYING");
	});

	test("play event should send currentTime with VIDEO_PLAYING", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.videoElem.currentTime = 42;
			let sendMessage = null;
			video.send = (type, msg) => { sendMessage = msg; };
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("play"));
			return sendMessage;
		});
		expect(result).toBe(42);
	});

	test("play event should record lastTick", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.lastTick = null;
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("play"));
			return typeof video.lastTick === "number";
		});
		expect(result).toBe(true);
	});

	// --- PAUSE EVENT ---

	test("pause event should update play button UI to play state", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("pause"));
			return {
				ariaLabel: video.playBtn.getAttribute("aria-label"),
				title: video.playBtn.title,
			};
		});
		expect(result.ariaLabel).toBe("Play");
		expect(result.title).toBe("Play");
	});

	test("pause event should send VIDEO_PAUSED analytics", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let sendType = null;
			video.send = (type) => { sendType = type; };
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("pause"));
			return sendType;
		});
		expect(result).toBe("VIDEO_PAUSED");
	});

	// --- REWIND ---

	test("rewind button should send VIDEO_REWIND and decrease currentTime", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.seek = 5;
			video.videoElem.currentTime = 30;
			video.videoElem.play = () => { return Promise.resolve(); };
			let sendType = null;
			video.send = (type) => { sendType = type; };
			video.attachListeners();
			video.rewindButton.click();
			return { sendType, currentTime: video.videoElem.currentTime };
		});
		expect(result.sendType).toBe("VIDEO_REWIND");
		expect(result.currentTime).toBe(25);
	});

	test("rewind button should disable button temporarily", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.seek = 5;
			video.videoElem.currentTime = 30;
			video.videoElem.play = () => { return Promise.resolve(); };
			video.send = () => {};
			video.attachListeners();
			video.rewindButton.click();
			return video.rewindButton.disabled;
		});
		expect(result).toBe(true);
	});

	// --- FORWARD ---

	test("forward button should send VIDEO_FORWARD and increase currentTime", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.seek = 5;
			video.videoElem.currentTime = 10;
			video.videoElem.play = () => { return Promise.resolve(); };
			let sendType = null;
			video.send = (type) => { sendType = type; };
			video.attachListeners();
			video.forwardButton.click();
			return { sendType, currentTime: video.videoElem.currentTime };
		});
		expect(result.sendType).toBe("VIDEO_FORWARD");
		expect(result.currentTime).toBe(15);
	});

	test("forward button should disable button temporarily", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.seek = 5;
			video.videoElem.currentTime = 10;
			video.videoElem.play = () => { return Promise.resolve(); };
			video.send = () => {};
			video.attachListeners();
			video.forwardButton.click();
			return video.forwardButton.disabled;
		});
		expect(result).toBe(true);
	});

	// --- SPEED SELECT ---

	test("speed select change should update video playbackRate", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.attachListeners();
			video.speedSelect.value = "2";
			video.speedSelect.dispatchEvent(new Event("change"));
			return video.videoElem.playbackRate;
		});
		expect(result).toBe(2);
	});

	test("speed select change should send VIDEO_SPEED_CHANGE analytics", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let sendType = null;
			video.send = (type) => { sendType = type; };
			video.videoElem.playbackRate = 1;
			video.attachListeners();
			video.speedSelect.value = "1.5";
			video.speedSelect.dispatchEvent(new Event("change"));
			return sendType;
		});
		expect(result).toBe("VIDEO_SPEED_CHANGE");
	});

	// --- MUTE ---

	test("mute button should toggle muted to true", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.attachListeners();
			video.muteBtn.click();
			return video.videoElem.muted;
		});
		expect(result).toBe(true);
	});

	test("mute button should toggle muted back to false on second click", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.attachListeners();
			video.muteBtn.click();
			video.muteBtn.click();
			return video.videoElem.muted;
		});
		expect(result).toBe(false);
	});

	test("mute button should send VIDEO_MUTED analytics", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let sendType = null;
			video.send = (type) => { sendType = type; };
			video.attachListeners();
			video.muteBtn.click();
			return sendType;
		});
		expect(result).toBe("VIDEO_MUTED");
	});

	test("mute button should update aria-label and title when muted", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.attachListeners();
			video.muteBtn.click();
			return {
				ariaLabel: video.muteBtn.getAttribute("aria-label"),
				title: video.muteBtn.title,
			};
		});
		expect(result.ariaLabel).toBe("Unmute");
		expect(result.title).toBe("Unmute");
	});

	test("mute button should update aria-label and title when unmuted", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.videoElem.muted = true;
			video.attachListeners();
			video.muteBtn.click();
			return {
				ariaLabel: video.muteBtn.getAttribute("aria-label"),
				title: video.muteBtn.title,
			};
		});
		expect(result.ariaLabel).toBe("Mute");
		expect(result.title).toBe("Mute");
	});

	// --- BUFFERING OVERLAY ---

	test("loadstart should show loading overlay", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.loadingOverlay.style.display = "none";
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("loadstart"));
			return video.loadingOverlay.style.display;
		});
		expect(result).toBe("flex");
	});

	test("waiting should show loading overlay", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.loadingOverlay.style.display = "none";
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("waiting"));
			return video.loadingOverlay.style.display;
		});
		expect(result).toBe("flex");
	});

	test("canplay should hide loading overlay", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.loadingOverlay.style.display = "flex";
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("canplay"));
			return video.loadingOverlay.style.display;
		});
		expect(result).toBe("none");
	});

	test("playing should hide loading overlay", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.loadingOverlay.style.display = "flex";
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("playing"));
			return video.loadingOverlay.style.display;
		});
		expect(result).toBe("none");
	});

	// --- TRACKING (lastTick) ---

	test("seeking should set lastTick to null", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.lastTick = 100;
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("seeking"));
			return video.lastTick;
		});
		expect(result).toBe(null);
	});

	test("waiting (for buffer) should set lastTick to null", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.lastTick = 100;
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("waiting"));
			return video.lastTick;
		});
		expect(result).toBe(null);
	});

	test("playing (after buffer) should reset lastTick", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.lastTick = null;
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("playing"));
			return typeof video.lastTick === "number";
		});
		expect(result).toBe(true);
	});

	// --- TIMEUPDATE ---

	test("timeupdate should update progress fill width", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.attachListeners();
			Object.defineProperty(video.videoElem, "duration", { get: () => 100, configurable: true });
			Object.defineProperty(video.videoElem, "currentTime", { get: () => 50, configurable: true });
			video.videoElem.dispatchEvent(new Event("timeupdate"));
			return video.progressFill.style.width;
		});
		expect(result).toBe("50%");
	});

	test("timeupdate should update time display", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.attachListeners();
			Object.defineProperty(video.videoElem, "duration", { get: () => 120, configurable: true });
			Object.defineProperty(video.videoElem, "currentTime", { get: () => 65, configurable: true });
			video.videoElem.dispatchEvent(new Event("timeupdate"));
			return video.timeDisplay.textContent;
		});
		expect(result).toBe("1:05 / 2:00");
	});

	test("timeupdate should send VIDEO_PROGRESS with correct percentage", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let sendType = null;
			let sendProgress = null;
			video.send = (type, msg) => { sendType = type; sendProgress = msg; };
			video.attachListeners();
			Object.defineProperty(video.videoElem, "duration", { get: () => 100, configurable: true });
			Object.defineProperty(video.videoElem, "currentTime", { get: () => 25, configurable: true });
			video.videoElem.dispatchEvent(new Event("timeupdate"));
			return { sendType, sendProgress };
		});
		expect(result.sendType).toBe("VIDEO_PROGRESS");
		expect(result.sendProgress).toBe(0.25);
	});

	// --- ENDED ---

	test("ended event should send VIDEO_PROGRESS with 1.0", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let sendType = null;
			let sendProgress = null;
			video.send = (type, msg) => { sendType = type; sendProgress = msg; };
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("ended"));
			return { sendType, sendProgress };
		});
		expect(result.sendType).toBe("VIDEO_PROGRESS");
		expect(result.sendProgress).toBe(1.0);
	});

	test("ended event should update play button text to Replay", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.attachListeners();
			video.videoElem.dispatchEvent(new Event("ended"));
			return video.playBtn.textContent;
		});
		expect(result).toBe("Replay");
	});

	// --- KEYBOARD SHORTCUTS ---

	test("Space key should play/pause via playBtn.click()", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let playClicked = false;
			video.playBtn.click = () => { playClicked = true; };
			video.send = () => {};
			video.attachListeners();
			video.videoContainer.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
			return playClicked;
		});
		expect(result).toBe(true);
	});

	test("ArrowRight key should trigger forward button click", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let forwardClicked = false;
			video.forwardButton.click = () => { forwardClicked = true; };
			video.send = () => {};
			video.attachListeners();
			video.videoContainer.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight" }));
			return forwardClicked;
		});
		expect(result).toBe(true);
	});

	test("ArrowLeft key should trigger rewind button click", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let rewindClicked = false;
			video.rewindButton.click = () => { rewindClicked = true; };
			video.send = () => {};
			video.attachListeners();
			video.videoContainer.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft" }));
			return rewindClicked;
		});
		expect(result).toBe(true);
	});

	test("KeyM should trigger mute button click", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let muteClicked = false;
			video.muteBtn.click = () => { muteClicked = true; };
			video.send = () => {};
			video.attachListeners();
			video.videoContainer.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyM" }));
			return muteClicked;
		});
		expect(result).toBe(true);
	});

	test("keyboard event should preventDefault for Space", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.send = () => {};
			video.attachListeners();
			const event = new KeyboardEvent("keydown", { code: "Space", cancelable: true });
			video.videoContainer.dispatchEvent(event);
			return event.defaultPrevented;
		});
		expect(result).toBe(true);
	});

	test("repeated keyboard events should be ignored", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			let playClicks = 0;
			video.playBtn.click = () => { playClicks++; };
			video.send = () => {};
			video.attachListeners();
			video.videoContainer.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", repeat: true }));
			return playClicks;
		});
		expect(result).toBe(0);
	});

	// --- SEEK OVERLAY ---

	test("rewind button should show seek overlay with negative offset", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.seek = 5;
			video.videoElem.play = () => { return Promise.resolve(); };
			video.send = () => {};
			video.attachListeners();
			video.rewindButton.click();
			return video.seekOverlay.textContent;
		});
		expect(result).toBe("-5s");
	});

	test("forward button should show seek overlay with positive offset", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.render();
			video.seek = 5;
			video.videoElem.play = () => { return Promise.resolve(); };
			video.send = () => {};
			video.attachListeners();
			video.forwardButton.click();
			return video.seekOverlay.textContent;
		});
		expect(result).toBe("+5s");
	});
});
