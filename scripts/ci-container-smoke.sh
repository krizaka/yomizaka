#!/usr/bin/env bash
# The org workflow's `container-smoke`: runs against the image just built (CI_IMAGE). The photo stack — sharp, the HEIC decoder and
# Tesseract in a worker thread — and the PDF reader in its worker (pdf.cjs) — must work inside it, under the production memory limit (App Platform's smallest instance, 512 MB).
set -euo pipefail
: "${CI_IMAGE:?CI_IMAGE is the image under test}"
docker run --rm --memory=512m -v "$PWD/deploy/docker/smoke:/smoke:ro" --entrypoint node "$CI_IMAGE" /smoke/photos.cjs
docker run --rm --memory=512m -v "$PWD/deploy/docker/smoke:/smoke:ro" --entrypoint node "$CI_IMAGE" /smoke/pdf.cjs
# The image-size budget (deploy/docker/image-size-budget-mb): the uncompressed size of the image just built. Measured 310 MB in CI on 2026-10-29
# (node:22-alpine, musl; the first guess of 120 MB was a local figure). A dependency that ships a native binary (OpenDAL, 59-82 MB) raises it in the same PR, with its reason, never silently.
budget_mb=$(tr -d '[:space:]' < deploy/docker/image-size-budget-mb)
size_mb=$(( $(docker image inspect "$CI_IMAGE" --format '{{.Size}}') / 1048576 ))
echo "image size: ${size_mb} MB (budget ${budget_mb} MB)"
if [ "$size_mb" -gt "$budget_mb" ]; then
  echo "The image is ${size_mb} MB, above its budget of ${budget_mb} MB (deploy/docker/image-size-budget-mb). Remove what grew it, or raise the budget in the PR with the reason." >&2
  exit 1
fi
