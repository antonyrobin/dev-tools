import React from 'react';
import { ImageDown } from 'lucide-react';
import ImageBatch from './ImageBatch';

const ImageCompressor = () => (
  <ImageBatch
    mode="compress"
    title="Image Compressor"
    description="Shrink JPEG, PNG, WebP and AVIF images in bulk with adjustable quality and max dimensions. Images never leave your browser."
    icon={ImageDown}
    color="#22c55e"
  />
);

export default ImageCompressor;
