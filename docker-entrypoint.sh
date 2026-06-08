#!/bin/sh
# Make the bundled tool resolvable from the mounted project: ESM bare-specifier
# resolution walks up from the config file, so a node_modules symlink in the
# working directory lets `qa.config.ts` import @hasan-qa-humans/* without the
# project having installed anything itself.
set -e
if [ ! -e node_modules ]; then
  ln -s /app/node_modules node_modules
fi
exec node /app/apps/cli/dist/index.js "$@"
