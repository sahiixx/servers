#!/bin/bash
# npx -y @modelcontextprotocol/inspector /Users/ochafik/code/modelcontextprotocol-servers/src/everything/run-stdio.sh
# files: {"README": "https://raw.githubusercontent.com/modelcontextprotocol/servers/refs/heads/main/README.md"}
set -euo pipefail

cd "$(dirname "$0")"
npm i >&2
npm run build >&2
npm run --silent start