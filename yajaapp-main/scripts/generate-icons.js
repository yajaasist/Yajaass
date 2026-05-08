const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const logoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#FFFFFF"/>
  <circle cx="256" cy="256" r="240" fill="#f3f4f6" stroke="#9ca3af" stroke-width="2"/>
  <text x="256" y="340" font-family="Arial, sans-serif" font-size="180" font-weight="bold" text-anchor="middle" fill="#6b7280">YAJA</text>
  <text x="256" y="380" font-family="Arial, sans-serif" font-size="40" text-anchor="middle" fill="#9ca3af" letter-spacing="3">ASISTENCIA</text>
</svg>
`;

const resolutions = [
  { name: 'mdpi', size: 48, folder: 'mipmap-mdpi' },
  { name: 'hdpi', size: 72, folder: 'mipmap-hdpi' },
  { name: 'xhdpi', size: 96, folder: 'mipmap-xhdpi' },
  { name: 'xxhdpi', size: 144, folder: 'mipmap-xxhdpi' },
  { name: 'xxxhdpi', size: 192, folder: 'mipmap-xxxhdpi' },
];

const basePath = './android/app/src/main/res';

async function generateIcons() {
  console.log('🎨 Generando iconos YAJA para Android...\n');
  
  for (const res of resolutions) {
    const folder = path.join(basePath, res.folder);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    
    const launcherPath = path.join(folder, 'ic_launcher.png');
    await sharp(Buffer.from(logoSvg))
      .resize(res.size, res.size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(launcherPath);
    
    console.log(`✅ ${res.name} (${res.size}px): ${launcherPath}`);
  }
  
  console.log('\n✨ Iconos generados exitosamente');
}

generateIcons().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
