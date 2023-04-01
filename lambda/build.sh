#!/usr/bin/env bash
echo "Packing lambda.zip"
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
npm install
zip -r -FS ../lambda.zip *
