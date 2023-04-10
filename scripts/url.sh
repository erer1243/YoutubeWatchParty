#!/bin/sh
DIR=`dirname "$0"`
BUCKET_ID=`< "$DIR/../names.json" jq ".BUCKET_ID" --raw-output`
REGION=us-east-1

echo "http://$BUCKET_ID.s3-website-$REGION.amazonaws.com"
