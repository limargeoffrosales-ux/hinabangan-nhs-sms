const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, 'public', 'logo.jpg');
const RES = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

// Android icon sizes per density
const ICONS = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// Adaptive icon foreground sizes (108dp, but rendered at density multipliers)
const FG_SIZES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

// Splash screen sizes
const SPLASH = {
  'drawable-port-mdpi': [360, 640],
  'drawable-port-hdpi': [540, 960],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [1080, 1920],
  'drawable-port-xxxhdpi': [1440, 2560],
  'drawable-land-mdpi': [640, 360],
  'drawable-land-hdpi': [960, 540],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1920, 1080],
  'drawable-land-xxxhdpi': [2560, 1440],
};

const BG_COLOR = '#1e3a5f';

async function generate() {
  console.log('Generating icons from', SRC);

  // Standard launcher icons
  for (const [dir, size] of Object.entries(ICONS)) {
    const outDir = path.join(RES, dir);
    await sharp(SRC)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(outDir, 'ic_launcher.png'));
    await sharp(SRC)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(outDir, 'ic_launcher_round.png'));
    console.log(`  ${dir}: ${size}x${size}`);
  }

  // Adaptive icon foreground (logo on transparent background)
  for (const [dir, size] of Object.entries(FG_SIZES)) {
    const padding = Math.round(size * 0.2);
    const innerSize = size - padding * 2;
    const outDir = path.join(RES, dir);

    // Create foreground: logo centered on transparent background
    const logo = await sharp(SRC)
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{ input: logo, left: padding, top: padding }])
      .png()
      .toFile(path.join(outDir, 'ic_launcher_foreground.png'));
    console.log(`  ${dir} foreground: ${size}x${size}`);
  }

  // Splash screens
  for (const [dir, [w, h]] of Object.entries(SPLASH)) {
    const outDir = path.join(RES, dir);
    const logoSize = Math.round(Math.min(w, h) * 0.35);

    const logo = await sharp(SRC)
      .resize(logoSize, logoSize, { fit: 'contain' })
      .toBuffer();

    await sharp({
      create: { width: w, height: h, channels: 4, background: BG_COLOR }
    })
      .composite([{ input: logo, left: Math.round((w - logoSize) / 2), top: Math.round((h - logoSize) / 2) }])
      .png()
      .toFile(path.join(outDir, 'splash.png'));
    console.log(`  splash ${dir}: ${w}x${h}`);
  }

  console.log('Done!');
}

generate().catch(e => { console.error(e); process.exit(1); });
