#!/bin/bash

VERSION="0.2.2"
OUTPUT_PREFIX="mrn-v$VERSION"

# Step 1: Create a demo version of the extension
echo "Creating a demo version of the extension..."
mkdir -p attached_assets

# Step 2: Create a simple file structure for the extension
mkdir -p $OUTPUT_PREFIX/extension
cp -r resources $OUTPUT_PREFIX/extension/
cp README.md $OUTPUT_PREFIX/extension/
cp manifest.json $OUTPUT_PREFIX/extension/package.json

# Step 3: Create a simple extension.js file
mkdir -p $OUTPUT_PREFIX/extension/out
cat > $OUTPUT_PREFIX/extension/out/extension.js << 'EOL'
// Simplified extension.js
function activate(context) {
    console.log('Minecraft Development Toolkit is now active!');
}

function deactivate() {}

module.exports = { activate, deactivate };
EOL

# Step 4: Create a ZIP archive of the extension (simulating a VSIX file)
echo "Creating a ZIP archive of the extension..."
cd $OUTPUT_PREFIX
zip -r ../attached_assets/$OUTPUT_PREFIX.vsix extension
cd ..

# Step 5: Create source code archive with fixed icon paths
echo "Creating source code archive..."
zip -r attached_assets/$OUTPUT_PREFIX-src.zip src resources manifest.json README.md package-extension.sh CHANGELOG.md GUIDE_FOR_USERS.md GITHUB_UPDATE.md VSIX_INSTALLATION_HELP.md tsconfig.json

echo "Done! Extension packaged as attached_assets/$OUTPUT_PREFIX.vsix and source code as attached_assets/$OUTPUT_PREFIX-src.zip"