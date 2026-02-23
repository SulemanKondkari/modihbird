const { Jimp } = require('jimp');

async function processImage() {
    try {
        const image = await Jimp.read('./public/assets/new_rahul_pillar.png');
        const w = image.bitmap.width; // 640
        const h = image.bitmap.height; // 640

        // Crop: x, y, width, height
        image.crop(Math.floor(w * 0.35), Math.floor(h * 0.35), Math.floor(w * 0.3), Math.floor(h * 0.65));

        await image.writeAsync('./public/assets/parsed_pillar.png');
        console.log("Successfully extracted parsed_pillar.png");
    } catch (e) {
        console.error(e);
    }
}
processImage();
