const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Konfigurace ořezu - procenta z původního obrázku
// Tyto hodnoty je třeba upravit podle skutečného layoutu obrázků
const CROP_CONFIG = {
  // Procento z horního okraje k odstranění (logo Dolti)
  topPercent: 12,
  // Procento z dolního okraje k odstranění (text)
  bottomPercent: 8,
  // Procento z levého okraje k odstranění (bílé pozadí + stín)
  leftPercent: 12,
  // Procento z pravého okraje k odstranění (bílé pozadí + stín)
  rightPercent: 8
};

const TEXTURES_DIR = path.join(__dirname, '../public/textures/decors');

async function cropTexture(inputPath, outputPath) {
  try {
    const metadata = await sharp(inputPath).metadata();
    const { width, height } = metadata;

    // Vypočítej ořezové hodnoty
    const left = Math.round(width * CROP_CONFIG.leftPercent / 100);
    const top = Math.round(height * CROP_CONFIG.topPercent / 100);
    const cropWidth = Math.round(width * (100 - CROP_CONFIG.leftPercent - CROP_CONFIG.rightPercent) / 100);
    const cropHeight = Math.round(height * (100 - CROP_CONFIG.topPercent - CROP_CONFIG.bottomPercent) / 100);

    console.log(`Processing: ${path.basename(inputPath)}`);
    console.log(`  Original: ${width}x${height}`);
    console.log(`  Crop: left=${left}, top=${top}, width=${cropWidth}, height=${cropHeight}`);

    await sharp(inputPath)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .toFile(outputPath);

    console.log(`  Saved: ${path.basename(outputPath)}`);
    return true;
  } catch (error) {
    console.error(`  Error processing ${inputPath}:`, error.message);
    return false;
  }
}

async function main() {
  // Seznam souborů k oříznutí
  const files = fs.readdirSync(TEXTURES_DIR).filter(f => f.endsWith('.png'));

  console.log('=== Crop Decor Textures ===\n');
  console.log(`Found ${files.length} PNG files in ${TEXTURES_DIR}\n`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const inputPath = path.join(TEXTURES_DIR, file);
    // Přepíše původní soubor oříznutou verzí
    const tempPath = path.join(TEXTURES_DIR, `temp_${file}`);

    const result = await cropTexture(inputPath, tempPath);

    if (result) {
      // Nahraď původní soubor
      fs.unlinkSync(inputPath);
      fs.renameSync(tempPath, inputPath);
      success++;
    } else {
      // Smaž temp soubor pokud existuje
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      failed++;
    }

    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
