#!/usr/bin/env bash
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
ZIP="../lambda.zip"
[ $ZIP -nt index.mjs ] && [ $ZIP -nt package.json ] && exit
npm install
zip -r -FS $ZIP *
