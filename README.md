Custom Multimedia Lesson
========================
CML (v A0.5.2) — _A small, lightweight, interactive lesson application_

## Description
This is a web application made from vanilla JavaScript, CSS, and HTML5. Its job is to facilitate a custom multi-page lesson.
This is accomplished with a parent window that holds the state of the lesson, plus a JSON file to add custom lessons with rules.

## Project Meta
This software is in a **working alpha** state.
The software may not work and may have drastic changes in the future.
There is no current guarantee that the JSON course data will be compatible with future versions

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
	1. Use the examples in the lesson folder for features
	2. It is _recommended_ to only use one type of media per page for chunking / segmentation
	3. Replace links to your media
	4. Put your media in the media folder
2. Update the course_data.json in the lessons folder
	1. Add overall course rules (see below)
	2. Copy and paste the course object in sequential order
	3. Modify the course object with your info (see below)
	4. Add completion rules per page (see below)
	5. Keep (or make your own) first and last page, where the first page is directions and the last page is a congrats
	6. Open the course to test for errors in the console log
	7. Do a dry run of your course from start to finish
	8. (optional) package your course via `make.sh` in the tools folder
	9. (optional) upload the SCORM 1.2 package to an LMS for further testing and publication

### Course Rules
Here is what the settings look like, starting with the overall course rules:

```JSON
{
"courseRules": {
	"minimumMinutes": 0.5,
	"minimumGrade": 0.70,
	"completeOnly": false,
	"studentsCanFail": true,
	"certificate": {
		"enabled": true,
		"title": "Certificate of Completion",
		"body": "This certifies that\n\n<b>{{studentName}}</b>\n\nhas successfully completed the mandated {{minimumLength}} minutes of training. Total Course Time: {{totalHours}} Hours ({{totalMinutes}} Minutes)\nFinal Score: {{score}}%",
		"logoUrl": "media/brand_logo.png",
		"signatureUrl": "media/instructor_sig.png",
		"watermarkUrl": "media/seal_watermark.png"
	}
},
```


| Property          | Notes                                                                                                  |
|-------------------|--------------------------------------------------------------------------------------------------------|
| `minimumMinutes`  | The minimum ammount of time the student must be on the course (in minutes)                             |
| `minimumGrade`    | The lowest grade to get a pass for the whole course                                                    |
| `completeOnly`    | Pass the student only if they completed every page. Do not report a grade                              |
| `studentsCanFail` | A failing grade will be reported to the LMS. If false, students must restart the course if they failed |
| `certificate`     | Optional cert at the end of the course with custom messages, branding, and data                        |


### Page Set Up
The page object looks like this, NOTE: *page order matters* :

```JSON
{
		"type": "article",
		"name": "directions.html",
		"articleText": "Welcome to the course...",
/* Completion Rules */
},
```


| Property    | Notes                                       |
|-------------|---------------------------------------------|
| `type`      | The page type (article, video, quiz, multi) |
| `name`      | The file name of the page                   |
| (details)   | Not currently used                          |


#### Possible Types
- Article
	- Used to convey text to read
	- Great for directions, signaling key points, objects, etc
	- Common Completion Rules:
		- watchTime: Enough time for a fast reader to read the page
		- scrolled: Detects that the student made it to the bottom
- Video
	- Used to show a static video with a custom player
	- Great for complex topics and visual demonstrations
	- Common Completion Rules:
		- watchTime: Enough time to watch 99% of the video
		- videoProgress: As much of the video that the student *needs* to watch. _Rarely_ 100%
- Quiz
	- Used to test knowledge (see below about questions)
	- Great for checking prior knowledge, highlighting key points, checking for understanding, summative knowledge
	- Common Completion Rules:
		- score: The minimum score to move on. Usually 70%
		- attempts:  How many attempts the student gets before blocking their submission (`0` or absent = unlimited)
- Programming
	- Used to run code the student writes, in a sandboxed editor on the page, and grade the result
	- Great for exercises where the student writes the logic themselves (function in, value out)
	- Common Completion Rules:
		- score: The minimum score to move on
		- requireSubmission: Every quiz or programming component on the page must have **passed** — attempting is not enough
		- attempts: How many runs the student gets. `0` or absent means unlimited — see the warnings below before you set it

#### Questions Object

Question Module Options
```JSON
"id": "quiz1",
"type": "quiz",
"options": ["show-wrong", "show-answer", "disable-anticheat"],
```

| Property           | Notes                                               |
|--------------------|-----------------------------------------------------|
| `id`               | The unique identifier of a question module          |
| `type`             | The type of module (quiz in this case)              |
| `options`          | Settings flags that can enable or disable features  |


| Property            | Notes                                                 |
|---------------------|-------------------------------------------------------|
| `show-wrong`        | Mark which answers are wrong                          |
| `show-answer`       | Shows the correct answers when the student finishes   |
| `disable-anticheat` | Unblocks right-click, select, copy+paste, and similal |


Common question set up:

```JSON
		"questions": [
		{
			"id": "Q1",
			"type": "multiple-choice",
			"text": "The sky is blue.",
			"correctAnswers": ["True"],
			"possibleAnswers": ["True", "False"],
			"pointValue": 1,
			"isCorrect": null,
			"choices": []
		},
		{
			"id": "Q2",
			"type": "short-answer",
			"text": "What is 3 + 1",
			"correctAnswers": ["4", "four"],
			"pointValue": 1,
			"isCorrect": null,
			"choices": []
		}
		]
```


| Property           | Notes                                               |
|--------------------|-----------------------------------------------------|
| `id`               | The unique identifier of a question, used analytics |
| `type`             | The type of question like multiple-choice           |
| `text`             | The question that the student is asked              |
| `correctAnswers`   | A list of the correct answers                       |
| `possibleAnswers`  | The choices the student has                         |
| `pointValue`       | The weight of the question                          |
| `isCorrect`        | Internal, do not change                             |
| `choices`          | Internal, do not change                             |


Questions are scored by checking the correctAnswers to the possibleAnswers (order does not matter). 
There is currently no partial credit. Weighting is determined by the computer adding up the point 
value of every question in the page. The overall course score is determined by adding all of possible 
points of every page and adding the total earned points. Dividing earned / possible, gives you your score.



#### Programming Object

A programming component puts a code editor on the page, runs what the student
writes in a sandboxed iframe, and grades the run. Add the element to the page's
HTML and configure it in `course_data.json`:

```HTML
<course-programming id="prog_hello"></course-programming>
```

```JSON
"components": [
	{
		"id": "prog_hello",
		"type": "programming",
		"language": "javascript",
		"starterCode": "function greet() {\n  return \"\";\n}\n\nconsole.log(greet());",
		"timeout": 5000,
		"expectedOutput": "Hello, World!",
		"bannedPatterns": [
			"console\\.log\\s*\\(\\s*['\"]Hello,\\s*World!['\"]\\s*\\)"
		],
		"testCases": [
			{
				"label": "greet() returns Hello, World!",
				"functionName": "greet",
				"args": [],
				"expected": "Hello, World!"
			}
		]
	}
]
```

`src/lessons/programming_example.html` is a working example of all of this — two
components, both graded, on a page that is part of the shipped lesson. The full
component reference lives in `docs/internal/programming-component.md`.

| Property                       | Notes                                                                                                                            |
|--------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| `id`                           | Unique identifier. Must match the `id` attribute on the `<course-programming>` element                                          |
| `type`                         | `"programming"`                                                                                                                  |
| `language`                     | Editor syntax mode only — `javascript`, `js`, `python`, `html`, `css`, `java`. **The runner always executes JavaScript**            |
| `starterCode`                  | Initial contents of the editor. The component falls back to a comment placeholder if empty                                         |
| `timeout`                      | Milliseconds before a run is killed (default `5000`)                                                                              |
| `expectedOutput`               | One point, if the run's stdout plus return value matches (see *Grading* below)                                                     |
| `testCases`                    | Array of test cases, one point each (see below)                                                                                    |
| `testCases[].label`            | Name of the row in the student's results panel. Defaults to `Test case N`                                                          |
| `testCases[].functionName`     | The function to call. Must exist in the student's code                                                                            |
| `testCases[].args`             | Arguments passed to it (default `[]`)                                                                                             |
| `testCases[].expected`         | What the call should return. **A case with no `expected`, or `expected: null`, is an authoring error** (see *Authoring traps*)      |
| `bannedPatterns`               | Regex strings. Code matching one is refused before it runs, and the refusal costs the student no attempt                           |
| `options`                      | Accepted, but the programming component does not act on any option today. The `show-wrong` / `show-answer` flags belong to `quiz`     |

##### Grading

Every criterion is worth one point. A component's maximum is the sum of its own
criteria — `expectedOutput` (if present) plus one per gradeable test case — and a
page's maximum is the sum across its components. A component with no
`expectedOutput` and no `testCases` cannot be scored, so it completes on a run
that does not error rather than on a score.

Two paths are supported and both work today:

- **`testCases` — the intended primary path.** The student's function is called
  with `args` and the return value is compared to `expected`. This is the one to
  reach for: it says what the code should *do*, not what it should print.
- **`expectedOutput` — stdout matching.** Everything the run printed, plus its
  return value, joined by newlines, is compared to `expectedOutput` after
  normalization. Useful for a single "run this and check the output" exercise.
  Both components in the shipped lesson use it alongside `testCases`.

##### Matching

Comparison is deliberately not a raw `===` on everything, because `expected`
crosses into the sandbox by `postMessage` and arrives as a fresh copy, so an
object could never be identical:

- **Text on both sides** (this includes every `expectedOutput`) is compared
  after normalization: carriage returns folded, each line trimmed, runs of
  whitespace collapsed to one space, blank lines dropped. Trailing spaces and
  blank lines therefore never fail a case.
- **Objects and arrays on both sides** are compared structurally and recursively.
  Key order does not matter, but the keys must match exactly — an extra or
  missing property fails.
- **Everything else** keeps a strict `===`, so numbers and booleans stay distinct
  from their text spelling: a case expecting the number `4` does not pass a
  function returning `"4"`.

##### Authoring traps

- **A test case with a missing or `null` `expected` is an authoring error.** It
  is not graded, it does not count toward the maximum, and the student gets a
  failing row they cannot do anything about. It is reported by name in the
  browser console — but only when a run happens, so the message lands in the
  student's console rather than yours. Run the exercise yourself once after
  adding cases to see it. Give every case an `expected`, or delete it.
- **A case whose `functionName` is not a function in the student's code** fails
  with "Function 'x' is not defined". A thrown error inside the function fails
  the case the same way.
- **Banned patterns are checked before the sandbox**, so a refusal never spends
  an attempt. The patterns are regexes — quote anything that is regex syntax, as
  in the example above.
- **`language` is cosmetic.** Setting `python` highlights like Python and still
  runs as JavaScript.
- **`attempts` is unforgiving.** `0` or absent means unlimited, which is what
  the shipped example uses. If you do set a limit, know that the Run button
  disables once it is gone and never comes back: the page's rule check ignores
  attempts entirely, so a student who runs out before reaching `score` cannot
  advance. The only way out is **Reset Course Progress** in the help menu, which
  clears their scores as well — the ↺ Reset button inside the component just
  empties the editor and does not return an attempt. Prefer `0`.

##### What a submission records

The saved course data holds **no copy of the student's source code**. Their
in-progress draft lives in the browser tab (`sessionStorage`), so a reload in the
same tab restores it but a save/resume in a new tab or on another machine does
not. The log records that a submission happened, its score, and when — not the
code, not the output it printed, and no attempt counter or time-to-complete
field: the number of submissions, and the time between them, can be derived from
those timestamps. (The page state does keep a count of runs, which is what the
"Attempts left" display reads.)


### Page Rules
*Each* page has access to these rules:

```JSON
/* rest of the page object */
		"completionRules": {
			"watchTime": 0,
			"score": 0.7,
			"scrolled": false,
			"attempts": 3,
			"videoProgress" : 0.0,
			"requireSubmission": false
		},
```


| Property            | Notes                                                                    |
|---------------------|--------------------------------------------------------------------------|
| `watchTime`         | How long the student must be on that page                                |
| `score`             | The minimum score to move on to the next page (use 0 to disable)         |
| `scrolled`          | The student must scroll to the bottom                                    |
| `attempts`          | How many times the student may submit on this page. `0` or absent means unlimited. On a quiz this caps the Submit button; on a programming page it caps the Run button, and once spent there is no way back (see *Authoring traps*) |
| `videoProgress`     | The percentage of the video that must be watched. 1.0 is the whole video | 
| `requireSubmission` | Something must be submitted by the student to move on (e.g. a quiz or a programming assignment) — specifically, every quiz and programming component on the page must have *passed*, not merely been attempted. Fails closed: the page must declare at least one quiz or programming component, otherwise it can never be completed (a load-time error names the page). See `docs/adr/0006-require-submission-fail-closed.md` |


### Creating a page in HTML
Each page in the lesson needs its own HTML file so the program can move the student to the next one. A basic template looks like this:

```HTML
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Multi Component Example</title>
	<link rel="stylesheet" href="lesson_styles.css">
	<script src="../internal/children.js"></script>
	<script src="../internal/components.js"></script>
</head>
<body>
	<h1>Page 1</h1></br>
	<course-article>
		<course-quiz id="quiz1"></course-quiz>
		<course-video id="intro_video" src="../media/1.mp4"></course-video>
		<course-quiz id="quiz2"></course-quiz>
	</course-article>
</body>
</html>

```


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

