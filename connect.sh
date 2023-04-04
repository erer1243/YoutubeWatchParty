#!/bin/sh
API_ENDPOINT=`aws apigatewayv2 get-apis | jq --raw-output '.Items | .[] | select(.Name == "YTWP-api") | .ApiEndpoint'`
if [ -z "$API_ENDPOINT" ]; then
  echo "Is it deployed?"
  exit 1
fi
STAGE_ENDPOINT="$API_ENDPOINT/main"
echo "Connecting to $STAGE_ENDPOINT"
websocat "$STAGE_ENDPOINT" "$@"
