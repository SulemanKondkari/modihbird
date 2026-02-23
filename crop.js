const { Jimp } = require('jimp');

Jimp.read('./public/assets/new_rahul_pillar.png').then(image => {
  image.crop(380, 560, 260, 460).write('./public/assets/parsed_pillar.png');
}).catch(console.error);
