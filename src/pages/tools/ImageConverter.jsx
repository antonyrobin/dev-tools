import React from 'react';
import { Images } from 'lucide-react';
import ImageBatch from './ImageBatch';

const ImageConverter = () => (
  <ImageBatch
    mode="convert"
    title="Image Converter"
    description="Convert images between PNG, JPEG, WebP, AVIF, BMP and ICO in bulk. Reads GIF, SVG and ICO too. Everything runs in your browser."
    icon={Images}
    color="#0ea5e9"
  />
);

export default ImageConverter;
