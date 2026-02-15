#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VAULT_DIR="$PROJECT_DIR/test-vault"
PLUGIN_DIR="$VAULT_DIR/.obsidian/plugins/co-intelligence"
OBSIDIAN_CONFIG="$HOME/Library/Application Support/obsidian/obsidian.json"

# Create plugin directory and symlinks
mkdir -p "$PLUGIN_DIR"
ln -sf "$PROJECT_DIR/dist/main.js" "$PLUGIN_DIR/main.js"
ln -sf "$PROJECT_DIR/dist/styles.css" "$PLUGIN_DIR/styles.css"
ln -sf "$PROJECT_DIR/manifest.json" "$PLUGIN_DIR/manifest.json"

# Build latest
echo "Building plugin..."
npm --prefix "$PROJECT_DIR" run build

# Register the vault with Obsidian if not already registered
if [ -f "$OBSIDIAN_CONFIG" ]; then
  if ! python3 -c "
import json, sys
with open('$OBSIDIAN_CONFIG') as f:
    config = json.load(f)
sys.exit(0 if any(v.get('path') == '$VAULT_DIR' for v in config.get('vaults', {}).values()) else 1)
"; then
    echo "Registering test vault with Obsidian..."
    python3 -c "
import json, hashlib, time
config_path = '$OBSIDIAN_CONFIG'
vault_path = '$VAULT_DIR'
with open(config_path) as f:
    config = json.load(f)
vault_id = hashlib.md5(vault_path.encode()).hexdigest()[:16]
config.setdefault('vaults', {})[vault_id] = {'path': vault_path, 'ts': int(time.time() * 1000)}
with open(config_path, 'w') as f:
    json.dump(config, f)
"
  fi
fi

# Open the test vault in Obsidian
echo "Opening test vault in Obsidian..."
ENCODED_PATH=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$VAULT_DIR'))")
open "obsidian://open?path=$ENCODED_PATH"

echo "Done. If this is the first time, enable the plugin in Settings > Community plugins."
