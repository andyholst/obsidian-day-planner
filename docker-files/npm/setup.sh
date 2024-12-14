#!/bin/sh

git config --global --add safe.directory /app
export npm_config_platform=linux
npm ci --no-package-lock --loglevel=silly --prefer-offline --no-audit --ignore-scripts

exec "$@"
