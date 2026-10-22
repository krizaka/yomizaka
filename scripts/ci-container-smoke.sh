#!/usr/bin/env bash
# The org workflow's `container-smoke`: runs against the image just built (CI_IMAGE). The photo stack — sharp, the HEIC decoder and
# Tesseract in a worker thread — must work inside it, under the production memory limit (App Platform's smallest instance, 512 MB).
set -euo pipefail
: "${CI_IMAGE:?CI_IMAGE is the image under test}"
docker run --rm --memory=512m -v "$PWD/deploy/docker/smoke:/smoke:ro" --entrypoint node "$CI_IMAGE" /smoke/photos.cjs
