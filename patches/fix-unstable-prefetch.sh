#!/bin/sh
# Patch Next.js 16.1.4 to avoid "Cannot access unstable_prefetch.mode on the server" error
# This is a confirmed bug where the runtime tries to dot into client module proxies.
# The Next.js team has a TODO acknowledging this in staged-validation.js:
#   "TODO(restart-on-cache-miss): Does this work correctly for client page/layout modules?"
# Answer: No, it doesn't. This patch fixes it.
#
# The fix: Before accessing .unstable_prefetch, check that the module is not a client
# reference proxy by testing for $$typeof (which IS in the proxy's allowlist).
# Client modules have $$typeof set; regular server modules do not.

COMPILED_DIR="node_modules/next/dist/compiled/next-server"
SOURCE_DIR="node_modules/next/dist/server/app-render"

echo "🔧 Patching Next.js 16.1.4 unstable_prefetch bug..."

# 1. Patch compiled runtime bundles (these are what actually run)
for FILE in "$COMPILED_DIR"/app-page*.js; do
    if [ -f "$FILE" ]; then
        # Dev bundles use full variable names
        if grep -q "layoutOrPageMod?layoutOrPageMod.unstable_prefetch" "$FILE" 2>/dev/null; then
            sed -i 's/layoutOrPageMod?layoutOrPageMod\.unstable_prefetch/layoutOrPageMod\&\&!layoutOrPageMod.\$\$typeof?layoutOrPageMod.unstable_prefetch/g' "$FILE"
            echo "  ✅ Patched (dev pattern): $(basename "$FILE")"
        fi
        # Prod bundles use minified single-char variable names — match the general pattern
        # Pattern: X=Y?Y.unstable_prefetch:void 0  →  X=Y&&!Y.$$typeof?Y.unstable_prefetch:void 0
        if grep -q 'unstable_prefetch:void 0' "$FILE" 2>/dev/null; then
            # Use sed with capture groups to handle minified var names
            sed -i 's/=\([a-zA-Z_][a-zA-Z_0-9]*\)?\1\.unstable_prefetch:void 0/=\1\&\&!\1.\$\$typeof?\1.unstable_prefetch:void 0/g' "$FILE"
            echo "  ✅ Patched (prod pattern): $(basename "$FILE")"
        fi
    fi
done

# 2. Patch source files (for non-turbo webpack builds)
for FILE in "$SOURCE_DIR/create-component-tree.js" "$SOURCE_DIR/staged-validation.js"; do
    if [ -f "$FILE" ]; then
        if grep -q "layoutOrPageMod ? layoutOrPageMod.unstable_prefetch" "$FILE" 2>/dev/null; then
            sed -i 's/layoutOrPageMod ? layoutOrPageMod\.unstable_prefetch/layoutOrPageMod \&\& typeof layoutOrPageMod === "object" \&\& !layoutOrPageMod.\$\$typeof ? layoutOrPageMod.unstable_prefetch/g' "$FILE"
            echo "  ✅ Patched (source): $(basename "$FILE")"
        fi
    fi
done

echo "✨ Next.js unstable_prefetch patch complete"
