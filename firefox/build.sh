#!/usr/bin/env bash

# https://raw.githubusercontent.com/chutten/statuser/gh-pages/build.sh
# RUN THIS IN THE PROJECT ROOT FOLDER TO BUILD THE XPI

cd addon
jpm xpi
NAME=$(echo @acceptum-*.xpi)
mv "$NAME" "../dist/${NAME//@}"

# set the version from `package.json`'s `"version"` field
VERSION=$(grep -o '"version"\s*:\s*"[^"]*' package.json | cut -d '"' -f 4 ) # read version from package.json
echo "read version $VERSION from package.json"
IFS=$'\n' # temporarily set the fields delimiter to newline
sed "s/{{\s*VERSION\s*}}/$VERSION/g" "../dist/update.rdf.template" | sed "2s;^;<!-- DO NOT EDIT - AUTOMATICALLY GENERATED FROM: ../build.sh -->\n\n;" |  tee ../dist/update.rdf > /dev/null
stat ../dist/acceptum-${VERSION}.xpi && jpm -v sign --api-key ${JPM_API_KEY} --api-secret ${JPM_API_SECRET} --xpi ../dist/acceptum-${VERSION}.xpi
mv acceptum-${VERSION}-fx.xpi ../dist/acceptum-${VERSION}.xpi
