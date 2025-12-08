#!/bin/bash

# Configuration
CLIENT_PKG="client/package.json"
SERVER_PKG="server/package.json"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required. Please install it (brew install jq)."
    exit 1
fi

echo "Current Versions:"
echo "Client: $(jq -r .version $CLIENT_PKG)"
echo "Server: $(jq -r .version $SERVER_PKG)"
echo ""

PS3="Select version Bump type: "
select type in "patch" "minor" "major" "quit"; do
    case $type in
        patch|minor|major)
            # Use npm version to bump (requires empty git or --no-git-tag-version)
            echo "Bumping $type version..."
            
            # Bump Client
            cd client && npm version $type --no-git-tag-version && cd ..
            
            # Bump Server
            cd server && npm version $type --no-git-tag-version && cd ..
            
            echo ""
            echo "New Versions:"
            echo "Client: $(jq -r .version $CLIENT_PKG)"
            echo "Server: $(jq -r .version $SERVER_PKG)"
            
            echo ""
            echo "Done! Remember to commit and deploy."
            break
            ;;
        quit)
            break
            ;;
        *) 
            echo "Invalid option $REPLY"
            ;;
    esac
done
