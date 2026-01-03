#!/bin/bash

# ACR Cleanup Script
# Usage: ./cleanup-acr.sh <acr-name> <repository-name> [keep-count]
# Example: ./cleanup-acr.sh myacr familytree 5

ACR_NAME=$1
REPO_NAME=$2
KEEP_COUNT=${3:-5}

if [ -z "$ACR_NAME" ] || [ -z "$REPO_NAME" ]; then
    echo "Usage: $0 <acr-name> <repository-name> [keep-count]"
    exit 1
fi

echo "--------------------------------------------------------"
echo "ACR Cleanup: $ACR_NAME/$REPO_NAME"
echo "Retention Policy: Keep latest $KEEP_COUNT images"
echo "--------------------------------------------------------"

# List manifests ordered by timestamp descending (newest first)
# Query extracts digests
# we use tail to skip the first $KEEP_COUNT lines
DIGESTS_TO_DELETE=$(az acr repository show-manifests --name $ACR_NAME --repository $REPO_NAME --orderby time_desc --query "[].digest" -o tsv | tail -n +$(($KEEP_COUNT + 1)))

if [ -z "$DIGESTS_TO_DELETE" ]; then
    echo "No old images found to delete (Total images <= $KEEP_COUNT)."
    exit 0
fi

echo "Found old images to delete..."

for digest in $DIGESTS_TO_DELETE; do
    echo "Deleting manifest: $digest"
    # Use --yes to skip confirmation prompt
    az acr repository delete --name $ACR_NAME --image $REPO_NAME@$digest --yes
done

echo "Cleanup complete."
