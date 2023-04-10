#!/bin/sh
LAMBDA_DIR=`dirname "$0"`/../lambda
cd $LAMBDA_DIR

ZIP="../lambda.zip"
[ $ZIP -nt index.mjs ] && [ $ZIP -nt package.json ] && exit
[ $ZIP -ot package.json ] && npm install
zip -r -FS $ZIP *
