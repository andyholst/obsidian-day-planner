#!/bin/sh

#rm -rf node_modules package-lock.json
git config --global --add safe.directory /app
# npm cache clean --force
export npm_config_platform=linux
npm install --no-package-lock --loglevel=silly --prefer-offline --no-audit --ignore-scripts
npm ci --no-package-lock --loglevel=silly --prefer-offline --no-audit --ignore-scripts

exec "$@"
