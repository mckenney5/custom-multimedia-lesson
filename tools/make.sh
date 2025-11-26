#!/bin/bash

echo "--Copying edited source code files"
mkdir -p ./example
rsync -av --update ../src/* ./example/
#cp -av --update ../src/. ./example/ # cp version if you do not have rsync

echo "--Creating manifest"
node make.manifest.js

echo "--Zipping course"
cd example
zip -rv ../test.zip .
cd ..

echo "--Done!"
