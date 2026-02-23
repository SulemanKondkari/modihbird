const { Jimp } = require('jimp');

async function run() {
    try {
        const image = await Jimp.read('./public/assets/new_rahul_pillar.png');
        console.log("Width:", image.bitmap.width, "Height:", image.bitmap.height);

        // The image is probably 1024x1024. Let's crop to just the middle pipe segment.
        // Assuming the face is in the middle of the pipe.
        // X: width/3, Y: height/2 - face height
        // Example crop (x, y, w, h)
        // Let's crop out a 200x300 section from the middle
        const w = image.bitmap.width;
        const h = image.bitmap.height;

        image.crop(Math.floor(w * 0.3), Math.floor(h * 0.45), Math.floor(w * 0.4), Math.floor(h * 0.3));
        await image.write('./public/assets/parsed_pillar.png');
        console.log("Successfully extracted parsed_pillar.png");
    } catch (e) {
        console.error(e);
    }
}
run();
