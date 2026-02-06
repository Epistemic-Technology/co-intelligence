#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VAULT_DIR="$PROJECT_DIR/test-vault"
PLUGIN_DIR="$VAULT_DIR/.obsidian/plugins/co-intelligence"

# Create plugin directory and symlinks
mkdir -p "$PLUGIN_DIR"
ln -sf "$PROJECT_DIR/dist/main.js" "$PLUGIN_DIR/main.js"
ln -sf "$PROJECT_DIR/dist/styles.css" "$PLUGIN_DIR/styles.css"
ln -sf "$PROJECT_DIR/manifest.json" "$PLUGIN_DIR/manifest.json"

# Build latest
echo "Building plugin..."
npm --prefix "$PROJECT_DIR" run build

# Open the test vault in Obsidian
echo "Opening test vault in Obsidian..."
open "obsidian://open?path=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$VAULT_DIR'))")"

echo "Done. If this is the first time, enable the plugin in Settings > Community plugins."
