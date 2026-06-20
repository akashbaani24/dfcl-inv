#!/usr/bin/env bash
# ============================================================
#  Convert FBX → GLB for the Fabric Studio
# ============================================================
#
#  Usage:
#    ./scripts/convert-fbx-to-glb.sh /path/to/input.fbx /path/to/output.glb
#
#  Or just drop the FBX in /tmp/couch-extract/ and run:
#    ./scripts/convert-fbx-to-glb.sh
#
#  This script uses Blender 3.6.9 (downloaded to /tmp on first run).
#
#  How to add a new model to the Fabric Studio:
#    1. User uploads a new .fbx or .zip file
#    2. If .zip: unzip to /tmp/couch-extract/
#    3. Run this script: ./scripts/convert-fbx-to-glb.sh input.fbx output.glb
#    4. Copy output.glb to /home/z/my-project/public/fabric-studio/
#    5. Add a new entry to the PRODUCTS array in
#       src/components/RealGLBFabricStudio.tsx with:
#         {
#           id: 'unique-id',
#           nameEn: 'Display Name',
#           nameBn: 'বাংলা নাম',
#           descEn: 'Description',
#           descBn: 'বর্ণনা',
#           glbUrl: '/fabric-studio/filename.glb',
#         }
#    6. Commit + push to GitHub
#
# ============================================================

set -e

INPUT="${1:-/tmp/couch-extract/couch.fbx}"
OUTPUT="${2:-/home/z/my-project/public/fabric-studio/couch.glb}"
BLENDER_DIR="/tmp/blender-3.6.9-linux-x64"
BLENDER_BIN="$BLENDER_DIR/blender"

# Download Blender if not present
if [ ! -f "$BLENDER_BIN" ]; then
  echo "→ Downloading Blender 3.6.9..."
  cd /tmp
  curl -sSL --max-time 180 -o blender.tar.xz "https://download.blender.org/release/Blender3.6/blender-3.6.9-linux-x64.tar.xz"
  tar -xf blender.tar.xz
  rm blender.tar.xz
fi

if [ ! -f "$INPUT" ]; then
  echo "❌ Input FBX not found: $INPUT"
  exit 1
fi

echo "→ Converting $INPUT → $OUTPUT"

# Write conversion Python script
cat > /tmp/_convert.py << EOF
import bpy, sys, os
bpy.ops.wm.read_factory_settings(use_empty=True)
print(f"Importing FBX from: $INPUT")
try:
    bpy.ops.import_scene.fbx(filepath="$INPUT")
    print("FBX imported successfully")
except Exception as e:
    print(f"FBX import error: {e}")
    sys.exit(1)
print(f"Imported objects: {[obj.name for obj in bpy.data.objects]}")
print(f"Meshes: {[m.name for m in bpy.data.meshes]}")
bpy.ops.object.select_all(action='SELECT')
print(f"Exporting GLB to: $OUTPUT")
try:
    bpy.ops.export_scene.gltf(
        filepath="$OUTPUT",
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_materials='EXPORT',
        export_yup=True,
    )
    print(f"GLB exported: {os.path.getsize('$OUTPUT')} bytes")
except Exception as e:
    print(f"GLB export error: {e}")
    sys.exit(1)
print("DONE")
EOF

"$BLENDER_BIN" --background --python /tmp/_convert.py 2>&1 | tail -20

if [ -f "$OUTPUT" ]; then
  SIZE=$(stat -c%s "$OUTPUT")
  echo ""
  echo "✅ Success!"
  echo "   Output: $OUTPUT"
  echo "   Size: $SIZE bytes ($(echo "scale=1; $SIZE/1024" | bc) KB)"
else
  echo "❌ Conversion failed — see output above"
  exit 1
fi
