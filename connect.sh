#!/bin/sh
API_ENDPOINT=`aws apigatewayv2 get-apis --output text --query "(Items[?Name == 'YTWP-api'].ApiEndpoint)[0]"`
if [ "$API_ENDPOINT" = "None" ]; then
  echo "Is it deployed?"
  exit 1
fi
STAGE_ENDPOINT="$API_ENDPOINT/main"
echo "Connecting to $STAGE_ENDPOINT"
websocat "$STAGE_ENDPOINT" "$@"
