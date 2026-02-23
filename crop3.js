const { Jimp } = require('jimp');

Jimp.read('./public/assets/new_rahul_pillar.png', (err, image) => {
    if (err) {
        console.error("Read Error");
        return;
    }
    const w = image.bitmap.width; // 640
    const h = image.bitmap.height; // 640

    // Crop: x, y, width, height
    image.crop(Math.floor(w * 0.35), Math.floor(h * 0.35), Math.floor(w * 0.3), Math.floor(h * 0.65));

    image.write('./public/assets/parsed_pillar.png', (writeErr) => {
        if (writeErr) {
            console.error("Write Error");
        } else {
            console.log("Successfully extracted parsed_pillar.png");
        }
    });
});
