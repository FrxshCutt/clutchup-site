#!/usr/bin/env bash
# Regenerate assets/img/screens/*.png from raw device screenshots.
#
# The site shows REAL screens from the shipped app — never mockups. When the UI
# changes, take fresh full-screen screenshots on an iPhone (1179x2556, i.e. a
# 15/16 Pro), drop them in ~/Downloads with the names below, and run this.
#
#   ./scripts/make-screenshots.sh
#
# macOS only: uses sips (built in) and a tiny Swift/CoreImage helper for the
# one privacy step below.
#
# PRIVACY: the drive-summary screen ends in a route-replay map of a real
# practice drive, with legible street names around the driver's home. Those are
# blurred out here before the file is ever committed. If you re-shoot that
# screen, keep the blur — or shoot a drive somewhere you don't mind publishing.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="${SRC_DIR:-$HOME/Downloads}"
OUT="assets/img/screens"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Source screenshot for each output name.
declare -a SHOTS=(
  "drive-summary|Screenshot 2026-09-02 at 15.50.51.png"
  "your-drives|Screenshot 2026-09-02 at 15.48.47.png"
  "home|Screenshot 2026-09-02 at 15.51.13.png"
  "subscription|Screenshot 2026-09-02 at 15.51.27.png"
)

cat > "$TMP/blur.swift" <<'SWIFT'
import Foundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers

// blur <in.png> <out.png> <topY> <height> <radius> — blurs a full-width band
// measured from the TOP edge of the image.
let a = CommandLine.arguments
guard a.count == 6,
      let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil),
      let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { exit(2) }
let W = CGFloat(cg.width), H = CGFloat(cg.height)
let topY = CGFloat(Double(a[3])!), bandH = CGFloat(Double(a[4])!)
// CoreImage's origin is bottom-left; the arguments are top-left.
let band = CGRect(x: 0, y: H - topY - bandH, width: W, height: bandH)
let base = CIImage(cgImage: cg)
let composed = base.cropped(to: band).clampedToExtent()
  .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: Double(a[5])!])
  .cropped(to: band).composited(over: base)
let ctx = CIContext(options: [.workingColorSpace: CGColorSpace(name: CGColorSpace.sRGB)!])
guard let out = ctx.createCGImage(composed, from: base.extent),
      let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL,
                                                 UTType.png.identifier as CFString, 1, nil)
else { exit(3) }
CGImageDestinationAddImage(dest, out, nil)
CGImageDestinationFinalize(dest)
SWIFT
swiftc -O "$TMP/blur.swift" -o "$TMP/blur"

mkdir -p "$OUT"
for entry in "${SHOTS[@]}"; do
  name="${entry%%|*}"
  file="$SRC/${entry#*|}"
  [ -f "$file" ] || { echo "missing: $file" >&2; exit 1; }

  work="$TMP/$name.png"
  if [ "$name" = "drive-summary" ]; then
    "$TMP/blur" "$file" "$work" 2366 190 26   # the route-replay map band
  else
    cp "$file" "$work"
  fi

  # 640px wide is 2x the largest size a screen is ever displayed at, so the
  # browser always downscales — which is also why JPEG is fine here despite the
  # fine UI text: q90 artefacts disappear under the 2x downscale, and the files
  # come out roughly half the size of the equivalent PNG.
  sips --resampleWidth 640 -s format jpeg -s formatOptions 90 "$work" \
       --out "$OUT/$name.jpg" >/dev/null
  echo "$OUT/$name.jpg  $(sips -g pixelWidth -g pixelHeight "$OUT/$name.jpg" | awk '/pixel/{printf "%sx", $2}' | sed 's/x$//')  $(du -h "$OUT/$name.jpg" | cut -f1)"
done
