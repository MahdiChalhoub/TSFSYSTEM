#!/bin/sh
# Patch Next.js 16.1.4 to avoid "Attempted to call generateViewport() from the server" error
# and regular property access errors on client proxies for metadata/viewport.

METADATA_FILE="node_modules/next/dist/lib/metadata/resolve-metadata.js"
COMPILED_DIR="node_modules/next/dist/compiled/next-server"

echo "🔧 Patching Next.js 16.1.4 metadata proxy bug..."

# 1. Patch the source file (uncompiled)
if [ -f "$METADATA_FILE" ]; then
    # Patch getDefinedViewport
    sed -i 's/if (typeof mod.generateViewport === .function.)/if (mod \&\& !mod\.\$\$typeof \&\& typeof mod.generateViewport === "function")/' "$METADATA_FILE"
    sed -i 's/return mod.viewport || null;/return (mod \&\& !mod\.\$\$typeof ? mod.viewport : null) || null;/' "$METADATA_FILE"
    
    # Patch getDefinedMetadata
    sed -i 's/if (typeof mod.generateMetadata === .function.)/if (mod \&\& !mod\.\$\$typeof \&\& typeof mod.generateMetadata === "function")/' "$METADATA_FILE"
    sed -i 's/return mod.metadata || null;/return (mod \&\& !mod\.\$\$typeof ? mod.metadata : null) || null;/' "$METADATA_FILE"
    
    echo "  ✅ Patched source: resolve-metadata.js"
fi

# 2. Patch compiled runtime bundles
# Since they are minified, we use a broader pattern that matches the logic.
# The logic for getDefinedViewport usually ends with the || null part.
for FILE in "$COMPILED_DIR"/app-page*.js; do
    if [ -f "$FILE" ]; then
        # Handle minified property access in dev/prod bundles
        # Look for the return pattern: .viewport||null
        # and replace with a safe version that checks for $$typeof.
        
        # Replace .generateViewport access
        sed -i 's/typeof \([a-zA-Z_0-9$]*\)\.generateViewport===\"function\"/\1\&\&!\1.\$\$typeof\&\&typeof \1.generateViewport===\"function\"/g' "$FILE"
        sed -i 's/typeof \([a-zA-Z_0-9$]*\)\.generateViewport===\x27function\x27/\1\&\&!\1.\$\$typeof\&\&typeof \1.generateViewport===\x27function\x27/g' "$FILE"
        
        # Replace .generateMetadata access
        sed -i 's/typeof \([a-zA-Z_0-9$]*\)\.generateMetadata===\"function\"/\1\&\&!\1.\$\$typeof\&\&typeof \1.generateMetadata===\"function\"/g' "$FILE"
        sed -i 's/typeof \([a-zA-Z_0-9$]*\)\.generateMetadata===\x27function\x27/\1\&\&!\1.\$\$typeof\&\&typeof \1.generateMetadata===\x27function\x27/g' "$FILE"
        
        # Replace the direct ||null returns if they exist
        sed -i 's/\([a-zA-Z_0-9$]*\)\.viewport||null/(\1\&\&!\1.\$\$typeof?\1.viewport:null)||null/g' "$FILE"
        sed -i 's/\([a-zA-Z_0-9$]*\)\.metadata||null/(\1\&\&!\1.\$\$typeof?\1.metadata:null)||null/g' "$FILE"

        echo "  ✅ Patched (potential): $(basename "$FILE")"
    fi
done

echo "✨ Next.js metadata proxy patch complete"
