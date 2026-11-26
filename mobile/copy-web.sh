#!/bin/sh
# Copies Flux Mobile (website/lite) and its fonts into the Android app.
set -e
cd "$(dirname "$0")"
rm -rf app/src/main/assets/www && mkdir -p app/src/main/assets/www
cp -r ../website/lite app/src/main/assets/www/lite
cp -r ../website/fonts app/src/main/assets/www/fonts
