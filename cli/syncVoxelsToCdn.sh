#!/bin/sh
# Copies the baked models in public/voxels to the AarcadeGh$t home CDN (cdn.aarcadeghst.com).
set -e
cd "$(dirname "$0")/.."
rsync -az --exclude '.DS_Store' public/voxels/ imacOmarchy:dev/AarcadeGh-t/services/cdn/cache/voxels/
