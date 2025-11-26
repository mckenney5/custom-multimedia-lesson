const fs = require('fs');
const path = require('path');

// CONFIGURATION
const TARGET_FOLDER = 'example'; // <-- where you keep all the course files
const WEBSITE = "com.example.www";
const ORGANIZATION = "example";
const COURSE_TITLE = "Example Custom SCORM Course";
const PLAYER_TITLE = "Course Player";

// Files to skip in manifest. index.html is required and is baked in so we can skip adding it dynamically
const BOILER = ["imsmanifest.xml", "index.html", "imsmd_rootv1p2p1.xsd", "imscp_rootv1p1p2.xsd", "ims_xml.xsd", "adlcp_rootv1p2.xsd"];

// This one seems to work for Schoology after 11 tries -_-
const SCORM_BOILER_HEAD =`<?xml version="1.0" standalone="no" ?>
<manifest identifier="${WEBSITE}" version="1"
					xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
					xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
					xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

		<organizations default="${ORGANIZATION}">
			<organization identifier="${ORGANIZATION}">
			<title>${COURSE_TITLE}</title>
			<item identifier="item_1" identifierref="resource_1">
				<title>${PLAYER_TITLE}</title>
			</item>
		</organization>
	</organizations>

	<resources>
		<resource identifier="resource_1" type="webcontent" adlcp:scormtype="sco" href="index.html">
			<file href="index.html" />
`;

// How the manifest is supposed to be...
/*
 * const SCORM_BOILER_HEAD_BAK = `<?xml version="1.0" standalone="no" ?>
<manifest identifier="us.pasd.www" version="1"
					xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
					xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
					xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
					xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
															http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">

	<metadata>
		<schema>ADL SCORM</schema>
		<schemaversion>1.2</schemaversion>
	</metadata>

	<organizations default="PASD">
		<organization identifier="PASD">
			<title>My Custom SCORM Course</title>
			<item identifier="item_1" identifierref="resource_1">
				<title>Course Player</title>
			</item>
		</organization>
	</organizations>

	<resources>
		<resource identifier="resource_1" type="webcontent" adlcp:scormtype="sco" href="index.html">
			<file href="index.html" />

`;
*/
const SCORM_BOILER_TAIL = `
		</resource>
	</resources>
</manifest>
`;

function getAllFiles(dirPath, arrayOfFiles = []) {
	// Check if the directory exists first
	if (!fs.existsSync(dirPath)) {
		console.log(`Directory "${dirPath}" not found.`);
		return [];
	}

	// Read all items in the directory
	const files = fs.readdirSync(dirPath);

	files.forEach(function(file) {
		// Create the full path based on the current directory being scanned
		const fullPath = path.join(dirPath, file);

		// Check if it is a directory or a file
		if (fs.statSync(fullPath).isDirectory()) {
			// If directory, go deeper (recursion)
			getAllFiles(fullPath, arrayOfFiles);
		} else {
			// If file, add the relative path to our list (removes TARGET_FOLDER prefix)
			arrayOfFiles.push(path.relative(TARGET_FOLDER, fullPath));
		}
	});

	return arrayOfFiles;
}

function writeListToTxt(files) {
	// Join the array with a newline character to put each path on its own line
	let xml = SCORM_BOILER_HEAD;
	const items = files.filter(f => !BOILER.includes(f)); // <-- filter out boilerplate listed above

	const resources = items.map(f => `\t\t\t<file href="${f}"/>`); // <-- add every file in the target folder besides boiler
	xml += resources.join('\n');
	xml += SCORM_BOILER_TAIL;
	fs.writeFileSync(TARGET_FOLDER + '/imsmanifest.xml', xml);
	console.log('File list saved to manifest');
}

// Run the function
console.log('Scanning...');
const allPaths = getAllFiles(TARGET_FOLDER);

// Output the list
console.log(allPaths);

writeListToTxt(allPaths);
