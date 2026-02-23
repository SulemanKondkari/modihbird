const sharp = require('sharp');
sharp('./public/assets/new_rahul_pillar.png')
  .extract({ left: 192, top: 192, width: 256, height: 256 })
  .toFile('./public/assets/parsed_pillar.png')
  .then(() => console.log('Cropped successfully'))
  .catch(err => console.error(err.message));
