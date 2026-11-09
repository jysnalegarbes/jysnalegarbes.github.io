/*
  Traces ImageData into an SVG string off the main thread, so the page stays
  responsive. imagetracerjs is public domain (Unlicense).
*/
import ImageTracer from 'imagetracerjs';

self.onmessage = (e: MessageEvent<{ id: number; image: ImageData; options: Record<string, number | boolean> }>) => {
  const { id, image, options } = e.data;
  try {
    const svg: string = ImageTracer.imagedataToSVG(image, options);
    self.postMessage({ id, svg });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
