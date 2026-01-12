import sharp from 'sharp'
import * as fs from 'fs'
import * as path from 'path'

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const inputSvg = path.join(process.cwd(), 'public/icons/icon.svg')
const outputDir = path.join(process.cwd(), 'public/icons')

async function generateIcons() {
  console.log('Generating PWA icons...\n')

  const svgBuffer = fs.readFileSync(inputSvg)

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`)

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath)

    console.log(`✓ Generated: icon-${size}x${size}.png`)
  }

  // Generate Apple Touch Icon (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(outputDir, 'apple-touch-icon.png'))
  console.log('✓ Generated: apple-touch-icon.png')

  // Generate favicon (32x32)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(process.cwd(), 'public/favicon.png'))
  console.log('✓ Generated: favicon.png')

  // Generate favicon.ico (16x16)
  await sharp(svgBuffer)
    .resize(16, 16)
    .png()
    .toFile(path.join(process.cwd(), 'public/favicon-16.png'))
  console.log('✓ Generated: favicon-16.png')

  console.log('\nDone! All icons generated.')
}

generateIcons().catch(console.error)
