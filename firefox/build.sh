#!/usr/bin/env bash

# https://raw.githubusercontent.com/chutten/statuser/gh-pages/build.sh
# RUN THIS IN THE PROJECT ROOT FOLDER TO BUILD THE XPI

rm dist/*.xpi
jpm xpi
NAME=$(echo @acceptum-*.xpi)
mv "$NAME" "dist/${NAME//@}"

# set the version from `package.json`'s `"version"` field
VERSION=$(grep -o '"version"\s*:\s*"[^"]*' package.json | cut -d '"' -f 4 ) # read version from package.json
echo "read version $VERSION from package.json"
IFS=$'\n' # temporarily set the fields delimiter to newline
for f in $(find -name '*.rdf.template' -or -name '*.html.template')
do
  echo "processing $f"
  sed "s/{{\s*VERSION\s*}}/$VERSION/g" "$f" | sed "2s;^;<!-- DO NOT EDIT - AUTOMATICALLY GENERATED FROM: $f -->\n\n;" |  tee ${f%.*} > /dev/null
done
