Custom Multimedia Lesson
========================
CML — _A small, lightweight, interactive lesson application_

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


## How to Contribute
Instead of submitting code, submit issues to the project.
If you want to know how the source code works, see the docs

