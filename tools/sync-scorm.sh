#!/bin/bash
# Sync SCORM API wrapper and XSD schemas from upstream sources.
# Usage: ./sync-scorm.sh
set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST_JS="${REPO}/src/internal/SCORM_API_wrapper.js"
DEST_XSD="${REPO}/src"
XSD_BASE="https://raw.githubusercontent.com/pipwerks/SCORM-Manifests/master/SCORM%201.2%20Manifest/SCORM-schemas"

echo "Downloading SCORM_API_wrapper.js from pipwerks..."
curl -sS "https://raw.githubusercontent.com/pipwerks/scorm-api-wrapper/master/src/JavaScript/SCORM_API_wrapper.js" -o "$DEST_JS"
echo "  -> $DEST_JS"

echo ""
echo "Downloading SCORM 1.2 XSD schemas from pipwerks/SCORM-Manifests..."

for f in adlcp_rootv1p2.xsd imscp_rootv1p1p2.xsd imsmd_rootv1p2p1.xsd ims_xml.xsd; do
	curl -sS "${XSD_BASE}/${f}" -o "${DEST_XSD}/${f}"
	echo "  -> src/${f}"
done

echo ""
echo "Done."
