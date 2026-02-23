const { Jimp } = require('jimp');
Jimp.read('./public/assets/new_rahul_pillar.png').then(image => {
  console.log("Width:", image.bitmap.width, "Height:", image.bitmap.height);
}).catch(console.error);
