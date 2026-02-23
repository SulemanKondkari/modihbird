const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const ASSETS_DIR = path.join(__dirname, 'public/assets');

const filesToProcess = ['new_rahul_pillar.png', 'modi_new.png', 'rahul_pillar_new.png', 'banana.png', 'modi_nano_banana.png', 'rahul_running.png', 'rahul_flying.png', 'rahul_gameover.png', 'modi_astronaut.png', 'modi_superhero.png'];

async function processImage(filename) {
    const inputPath = path.join(ASSETS_DIR, filename);
    const outputPath = path.join(ASSETS_DIR, `transparent_${filename}`);

    if (!fs.existsSync(inputPath)) {
        console.log(`Skipping: ${filename} (Not found)`);
        return;
    }

    try {
        const image = await Jimp.read(inputPath);

        // Define tolerance for "white"
        const tolerance = 15; // out of 255

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];
            const alpha = this.bitmap.data[idx + 3];

            // If it's near white, make it fully transparent
            if (red > 255 - tolerance && green > 255 - tolerance && blue > 255 - tolerance && alpha === 255) {
                this.bitmap.data[idx + 3] = 0; // Set Alpha to 0
            }
        });

        await image.write(outputPath);

        // Overwrite original
        fs.renameSync(outputPath, inputPath);

        console.log(`Successfully processed: ${filename}`);
    } catch (err) {
        console.error(`Error processing ${filename}:`, err);
    }
}

async function main() {
    console.log("Starting transparency processing...");
    for (const file of filesToProcess) {
        await processImage(file);
    }
    console.log("Finished asset processing.");
}

main();
