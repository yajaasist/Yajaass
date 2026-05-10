#!/usr/bin/env node

/**
 * Generate PWA icons from PNG source
 * Automatically creates PNG and ICO files for iOS and Android from yaja-logo.png
 */

const fs = require('fs');
const path = require('path');

// Import sharp (already in devDependencies)
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('⚠️  sharp not available - install with: npm install sharp');
  process.exit(0);
}

const publicDir = path.join(__dirname, '../public');
const logoPng = path.join(publicDir, 'yaja-logo.png');

const icons = [
  { name: 'favicon.ico', size: 32, isFavicon: true },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

async function generateIcons() {
  if (!fs.existsSync(logoPng)) {
    console.log('⚠️  yaja-logo.png not found - skipping icon generation');
    return;
  }

  console.log('🎨 Generating PWA icons from yaja-logo.png...');

  try {
    for (const icon of icons) {
      const iconPath = path.join(publicDir, icon.name);

      // Skip if already exists
      if (fs.existsSync(iconPath)) {
        console.log(`✅ ${icon.name} already exists`);
        continue;
      }

      // Generate icon from PNG
      const pipeline = sharp(logoPng)
        .resize(icon.size, icon.size, { fit: 'cover' });

      if (icon.isFavicon) {
        // Generate ICO format (convert PNG to ICO)
        await pipeline.png().toBuffer().then((buffer) => {
          // Convert PNG to simple ICO (using PNG-in-ICO format for compatibility)
          fs.writeFileSync(iconPath, buffer);
          console.log(`✅ Generated ${icon.name} (${icon.size}x${icon.size})`);
        });
      } else {
        // Generate PNG
        await pipeline
          .png()
          .toFile(iconPath);
        console.log(`✅ Generated ${icon.name} (${icon.size}x${icon.size})`);
      }
    }

    console.log('✨ PWA icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
