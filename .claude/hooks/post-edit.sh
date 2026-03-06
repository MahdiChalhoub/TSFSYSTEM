#!/bin/bash
# Post-Edit Hook: Runs after Edit tool is used
# Auto-runs TypeScript check on edited files

# Parse stdin for file path (Claude Code provides session data via stdin)
FILE_PATH=$(echo "$CLAUDE_TOOL_RESULT" | jq -r '.file_path // empty' 2>/dev/null)

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Only check TypeScript files in src/
if [[ "$FILE_PATH" == src/*.tsx ]] || [[ "$FILE_PATH" == src/*.ts ]]; then
  echo "🔍 TypeScript check on $FILE_PATH..."

  # Run typecheck and filter for this file
  npm run typecheck 2>&1 | grep -E "(error|$FILE_PATH)" | head -10

  if [ $? -eq 0 ]; then
    echo "⚠️  TypeScript errors detected. Please fix before proceeding."
  else
    echo "✅ No TypeScript errors detected."
  fi
fi

exit 0
