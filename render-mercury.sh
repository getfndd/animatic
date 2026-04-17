#!/bin/bash
export NODE_OPTIONS="--dns-result-order=ipv4first"
mkdir -p renders
npx remotion render Sequence --props=./examples/fintech-sizzle/render-props.json --output=./renders/fintech-sizzle.mp4
