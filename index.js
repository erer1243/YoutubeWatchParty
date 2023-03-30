#!/usr/bin/env node
const { App, Stack } = require("aws-cdk-lib");

const app = new App();
const stack = new Stack(app, "YTWatchParty");

app.synth();
