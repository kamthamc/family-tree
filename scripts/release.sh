#!/bin/bash
set -e

# Configuration
CHANGELOG_FILE="CHANGELOG.md"
CLIENT_PKG="client/package.json"
SERVER_PKG="server/package.json"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required. Please install it (brew install jq)."
    exit 1
fi

echo "----------------------------------------------------"
echo "  Family Tree Release Wizard"
echo "----------------------------------------------------"

# 1. Get Current Versions
CURRENT_VERSION=$(jq -r .version $CLIENT_PKG)
echo "Current Version: v$CURRENT_VERSION"

# 2. Select Bump Type
echo ""
PS3="Select Release Type: "
select type in "patch" "minor" "major" "quit"; do
    case $type in
        patch|minor|major)
            BUMP_TYPE=$type
            break
            ;;
        quit)
            exit 0
            ;;
        *) 
            echo "Invalid option $REPLY"
            ;;
    esac
done

# 3. Calculate New Version (Dry Run)
# We use npm version in a subshell to peek the next version
cd client
NEW_VERSION=$(npm version $BUMP_TYPE --no-git-tag-version --dry-run | head -n 1 | sed 's/v//')
# Reset changes from dry run if any (npm version --dry-run usually doesn't modify, but just in case)
cd ..

echo ""
echo "Target Version: v$NEW_VERSION"
echo "----------------------------------------------------"

# 4. Collect Changelog Items
ADDED_ITEMS=()
FIXED_ITEMS=()
CHANGED_ITEMS=()

collect_items() {
    local category=$1
    local prompt=$2
    echo ""
    echo "What triggers '$category'? (Press Enter to finish category)"
    while true; do
        read -p "$prompt > " item
        if [ -z "$item" ]; then
            break
        fi
        eval "$category+=(\"\$item\")"
    done
}

collect_items "ADDED_ITEMS" "Added"
collect_items "FIXED_ITEMS" "Fixed"
collect_items "CHANGED_ITEMS" "Changed"

# 5. Generate Changelog Entry
DATE=$(date +%Y-%m-%d)
ENTRY="## [$NEW_VERSION] - $DATE"

if [ ${#ADDED_ITEMS[@]} -gt 0 ]; then
    ENTRY="$ENTRY\n### Added"
    for item in "${ADDED_ITEMS[@]}"; do
        ENTRY="$ENTRY\n- $item"
    done
fi

if [ ${#FIXED_ITEMS[@]} -gt 0 ]; then
    ENTRY="$ENTRY\n### Fixed"
    for item in "${FIXED_ITEMS[@]}"; do
        ENTRY="$ENTRY\n- $item"
    done
fi

if [ ${#CHANGED_ITEMS[@]} -gt 0 ]; then
    ENTRY="$ENTRY\n### Changed"
    for item in "${CHANGED_ITEMS[@]}"; do
        ENTRY="$ENTRY\n- $item"
    done
fi

ENTRY="$ENTRY\n"

# 6. Preview
echo "----------------------------------------------------"
echo "Previewing Changelog Entry:"
echo -e "$ENTRY"
echo "----------------------------------------------------"

read -p "Proceed with Release? (y/n) " confirm
if [[ $confirm != "y" ]]; then
    echo "Aborted."
    exit 0
fi

# 7. Apply Changes

# Update Changelog
# Insert after header (Line 6 usually, looking for first ## or inserting after description)
# We assume standard format. We'll insert after the line that says "Semantic Versioning..." or similar,
# Or typically after the header block.
# Let's find the first "## [" line and insert before it, or if not found, append.
TMP_FILE=$(mktemp)
HEADER_END=$(grep -n "^## \[" "$CHANGELOG_FILE" | head -n 1 | cut -d: -f1)

if [ -z "$HEADER_END" ]; then
    # No existing entries, append to end
    echo -e "$ENTRY" >> "$CHANGELOG_FILE"
else
    # Insert before first entry
    head -n $((HEADER_END-1)) "$CHANGELOG_FILE" > "$TMP_FILE"
    echo -e "$ENTRY" >> "$TMP_FILE"
    tail -n +$HEADER_END "$CHANGELOG_FILE" >> "$TMP_FILE"
    mv "$TMP_FILE" "$CHANGELOG_FILE"
fi
echo "Updated $CHANGELOG_FILE"

# Bump Versions
echo "Bumping package.json versions..."
cd client && npm version $BUMP_TYPE --no-git-tag-version >/dev/null && cd ..
cd server && npm version $BUMP_TYPE --no-git-tag-version >/dev/null && cd ..

echo "----------------------------------------------------"
echo "Release v$NEW_VERSION Completed!"
echo "1. Review CHANGELOG.md"
echo "2. Commit changes: git commit -am \"chore: release v$NEW_VERSION\""
echo "3. Deploy: ./azure/deploy.sh"
echo "----------------------------------------------------"
