#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "\n${CYAN}🔍 Checking project integrity from the last 7 days...${NC}\n"

echo -e "${YELLOW}------------------------------------------------------${NC}"
echo -e "${YELLOW}📂 Unsaved/Uncommitted Changes (Current State)${NC}"
echo -e "${YELLOW}------------------------------------------------------${NC}"
CHANGES=$(git status -s)
if [ -z "$CHANGES" ]; then
    echo -e "${GREEN}✅ Working directory is clean. No uncommitted changes.${NC}"
else
    git status -s
fi

echo -e "\n${YELLOW}------------------------------------------------------${NC}"
echo -e "${YELLOW}🗑️  Files Deleted in the last 7 days (Committed)${NC}"
echo -e "${YELLOW}------------------------------------------------------${NC}"
# Look for commits in the last 7 days that deleted files
DELETED=$(git log --since="1 week ago" --diff-filter=D --name-status --oneline | grep "^D")
if [ -z "$DELETED" ]; then
    echo -e "${GREEN}✅ No files were permanently deleted in commits over the last 7 days.${NC}"
else
    echo -e "${RED}⚠️  The following files were deleted in recent commits:${NC}"
    echo "$DELETED"
fi

echo -e "\n${YELLOW}------------------------------------------------------${NC}"
echo -e "${YELLOW}⏪ Potentially Dropped/Reset Commits (Reflog)${NC}"
echo -e "${YELLOW}------------------------------------------------------${NC}"
# Look at the reflog for resets or rebases which might indicate lost work
RESETS=$(git reflog show --since="1 week ago" | grep -iE "reset:|drop|rebase")
if [ -z "$RESETS" ]; then
    echo -e "${GREEN}✅ No risky git operations (hard resets, rebases) detected. No lost commits.${NC}"
else
    echo -e "${RED}⚠️  Found history rewrites or resets. You might want to check these:${NC}"
    echo "$RESETS"
fi

echo -e "\n${YELLOW}------------------------------------------------------${NC}"
echo -e "${YELLOW}📜 All Commits Saved in the last 7 days${NC}"
echo -e "${YELLOW}------------------------------------------------------${NC}"
git log --since="1 week ago" --format="${CYAN}%h${NC} - %cd - %s" --date=short

echo -e "\n${GREEN}✅ Integrity check complete!${NC}\n"
