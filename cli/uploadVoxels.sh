#!/bin/sh
# Uploads the baked models in public/voxels to the Vercel Blob store named by
# BLOB_READ_WRITE_TOKEN (read from .env.local) and prints the base URL to deploy with.
set -e
cd "$(dirname "$0")/.."
set -a
. ./.env.local
set +a
cd public/voxels
find . -type f ! -name '.DS_Store' | sed 's|^\./||' |
  xargs -P 8 -I{} vercel blob put "{}" --access public --pathname "voxels/{}" --allow-overwrite true --rw-token "$BLOB_READ_WRITE_TOKEN" > /dev/null
vercel blob list --rw-token "$BLOB_READ_WRITE_TOKEN" --limit 1
echo "Set VITE_VOXEL_BASE_URL to the store's https://<id>.public.blob.vercel-storage.com/voxels/"
