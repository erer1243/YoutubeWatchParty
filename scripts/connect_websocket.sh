#!/bin/sh
DIR=`dirname "$0"`
API_NAME=`< "$DIR/../names.json" jq ".API_NAME" --raw-output`
API_ENDPOINT=`aws apigatewayv2 get-apis --output text --query "(Items[?Name == '$API_NAME'].ApiEndpoint)[0]"`
if [ "$API_ENDPOINT" = "None" ]; then
  echo "Is it deployed?"
  exit 1
fi
STAGE_ENDPOINT="$API_ENDPOINT/main"
echo "Connecting to $STAGE_ENDPOINT"
websocat "$STAGE_ENDPOINT" "$@"
