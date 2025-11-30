Custom Multimedia Lesson
========================
CML (v A0.2.0) — _A small, lightweight, interactive lesson application_

## Description
This is a web application made from vanilla JavaScript, CSS, and HTML5. Its job is to facilitate a custom multi-page lesson.
This is accomplished with a parent window that holds the state of the lesson, plus a JSON file to add custom lessons with rules.

## Project Meta
This software is in a **working alpha** state.
The software may not work and may have drastic changes in the future.
There is no guarantee that the JSON course data will be compatible with future versions

## License
This code is licensed under the GNU GPL v3. See 'LICENSE' for details. 

## Compiling and Testing
Point a web server to index.html. The console will complain of no LMS connection. It will work on stand alone mode.
You can also package it into a [SCORM 1.2](https://scorm.com/scorm-explained/technical-scorm/scorm-12-overview-for-developers/) course.
To spin up a quick web server try `python3 -m http.server 8080` in the same folder. You can also go into the tool folder and run `bash testing_web_server.sh`

### SCORM Packaging
Shared in this repo are tools that will help you package the SCORM course so you do not have to do it by hand.

To make a SCORM package using these tools, you need the following system:

- GNU/Linux
- rsync (or GNU's `cp` if you modify the script)
- zip
- node

To make the package:
- Go into the tools folder `cd tools`
- Create a directory called 'example' `mkdir example`
- Place [SCORM files](https://github.com/pipwerks/SCORM-Manifests/tree/master/SCORM%201.2%20Manifest/SCORM-schemas) in the example folder
- Place [this SCORM wrapper](https://raw.githubusercontent.com/pipwerks/scorm-api-wrapper/refs/heads/master/src/JavaScript/SCORM_API_wrapper.js) program into the folder
- Run `bash make.sh`. It will copy the src files and generate the manifest
- You now have a zip file called 'test.zip' that that _should_ function as a SCORM 1.2 course
- Test your course on an LMS

#### Tested LMSs via SCORM 1.2
| LMS         | Status  | Notes     |
|-------------|:-------:|-----------|
| SCORM Cloud | Working | Forgiving |
| Schoology   | Working | Strict    |
| Moodle      | -       | -         |
| D2L         | -       | -


## How to Make a Course
Currently, there is no way to automate course making *yet*.

### Steps
Here are the current steps to make your own course:

1. Add HTML files to the lesson folder
	a. Use the examples in the lesson folder for features
	b. It is recommended to only use one type of media per page for chunking / segmentation
	c. Replace links to your media
	d. Put your media in the media folder
2. Update the course_data.json in the lessons folder
	a. Add overall course rules (see below)
	b. Copy and paste the course object in sequential order
	c. Modify the course object with your info (see below)
	d. Add completion rules per page (see below)
	e. Keep (or make your own) first and last page, where the first page is directions and the last page a congrats
	f. Open the course to test for errors in the console log
	g. Do a dry run of your course from start to finish
	h. (optional) package your course via `make.sh` in the tools folder
	i. (optional) upload the SCORM 1.2 package to an LMS for further testing and publication

### Course Rules
The object looks like this:

```JSON
{
	"courseRules": {
		"minimumMinutes": 1.5,
		"minimumGrade": 0.70,
		"completeOnly": false,
		"studentsCanFail": true
},
```


| Property          | Notes                                                                                                  |
|-------------------|--------------------------------------------------------------------------------------------------------|
| `minimumMinutes`  | The minimum ammount of time the user must be on the course (in minutes)                                |
| `minimumGrade`    | The lowest grade to get a pass for the whole course                                                    |
| `completeOnly`    | Pass the user only if they completed every page. Do not report a grade                                 |
| `studentsCanFail` | A failing grade will be reported to the LMS. If false, students must restart the course if they failed |


### Page Set Up
The page object looks like this, not *page order matters* :

```JSON
{
		"type": "article",
		"name": "directions.html",
		"articleText": "Welcome to the course...",
/* Completion Rules */
},
```


| Property    | Notes                                |
|-------------|--------------------------------------|
| `type`      | The page type (article, video, quiz) |
| `name`      | The file name of the page            |
| (details)   | Not currently used                   |


#### Possible Types
- Article
	- Used to convey text to read
	- Great for directions, signaling key points, objects, etc
	- Common Completion Rules:
		- watchTime --> Enough time for a fast reader to read the page
		- scrolled --> Detects that the user made it to the bottom
- Video
	- Used to show a static video with a custom player
	- Great for complex topics and visual demonstrations
	- Common Completion Rules:
		- watchTime --> Enough time to watch 99% of the video
		- videoProgress --> As much of the video that the student *needs* to watch. Rarely 100%
- Quiz
	- Used to test knowledge (see below about questions)
	- Great for checking prior knowledge, highlighting key points, checking for understanding, summative knowledge
	- Common Completion Rules:
		- score --> The minimum score to move on. Usually 70%
		- attempts --> How many attempts the student gets before blocking their submission

#### Questions Object
Common question set up:

```JSON
		"questions": [
			{
				"id": "Q1",
				"text": "True False Questions give you a 50/50 shot of guessing right?",
				"correctAnswers": ["True"],
				"possibleAnswers": ["True", "False"],
				"pointValue": 1,
				"isCorrect": null,
				"choices": []
			}
		]
```


| Property           | Notes                                               |
|--------------------|-----------------------------------------------------|
| `id`               | The unique identifier of a question, used analytics |
| `text`             | The question that the student is asked              |
| `correctAnswers`   | A list of possible correct answers                  |
| `possibleAnswers`  | The choices the student has                         |
| `pointValue`       | The weight of the question                          |
| `isCorrect`        | Internal, do not change                             |
| `choices`          | Internal, do not change                             |


Questions are scored by checking the correctAnswers to the possibleAnswers (order does not matter). 
There is currently no partial credit. Weighting is determined by the computer adding up the point 
value of every question in the page. The overall course score is determined by adding all of possible 
points of every page and adding the total earned points. Dividing earned / possible, gives you your score.



### Page Rules
*Each* page has access to these rules:

```JSON
/* rest of the page object */
		"completionRules": {
			"watchTime": 0,
			"score": 0.7,
			"scrolled": false,
			"attempts": 3,
			"videoProgress" : 0.0
		},
```


| Property           | Notes                                                                    |
|--------------------|--------------------------------------------------------------------------|
| `watchTime`        | How long the student must be on that page                                |
| `score`            | The minimum score to move on (use 0 to disable)                          |
| `scrolled`         | The student must scroll to the bottom                                    |
| `attempts`         | The ammount of time the student can submit quiz answers                  |                         |
| `videoProgress`    | The percentage of the video that must be watched. 1.0 is the whole video |                              |


### Course Check List
- [ ] There are no errors in the course console
- [ ] Videos work
- [ ] Audio works with headphones
- [ ] Audio works in both ears
- [ ] Audio is loud enough
- [ ] Questions work and answers are correct

## How to Contribute
Instead of submitting code, submit issues to the project.
If you want to know how the source code works, see the docs

