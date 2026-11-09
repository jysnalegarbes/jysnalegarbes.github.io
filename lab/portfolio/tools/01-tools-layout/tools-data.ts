/*
  The tools, as the /tools/ page layout options show them (frozen for the
  lab round). `shot` is a real screenshot of the tool in use, captured from
  the site with Jayson's own projects and portrait as content.
*/
import pdf from '../../../../src/assets/tools/pdf.png';
import compress from '../../../../src/assets/tools/compress.png';
import convert from '../../../../src/assets/tools/convert.png';
import background from '../../../../src/assets/tools/background.png';
import upscale from '../../../../src/assets/tools/upscale.png';
import mockup from '../../../../src/assets/tools/mockup.png';

export type Input = 'pdf' | 'image';

export const tools = [
  {
    key: 'pdf',
    href: '/tools/pdf/',
    name: 'PDF Studio',
    verb: 'Edit, merge and sign PDFs',
    summary: 'Reorder, rotate and split pages, add text, images and signatures, cover and retype, fill in forms.',
    input: 'pdf' as Input,
    shot: pdf,
  },
  {
    key: 'compress',
    href: '/tools/pdf-compress/',
    name: 'PDF Compressor',
    verb: 'Shrink a PDF to send it',
    summary: 'Make PDFs small enough to email or upload. Keeps text sharp, or flattens pages for the smallest file.',
    input: 'pdf' as Input,
    shot: compress,
  },
  {
    key: 'image',
    href: '/tools/image/',
    name: 'Image Converter',
    verb: 'Change an image’s format or size',
    summary: 'PNG, JPG, WebP, traced SVG, favicon ICO or one PDF. Resize and compress a whole batch.',
    input: 'image' as Input,
    shot: convert,
  },
  {
    key: 'background',
    href: '/tools/background/',
    name: 'Background Remover',
    verb: 'Cut the subject out of a photo',
    summary: 'AI cut-outs of people, products and pets: transparent, on a colour, or on a blurred backdrop.',
    input: 'image' as Input,
    shot: background,
  },
  {
    key: 'upscale',
    href: '/tools/upscale/',
    name: 'Image Upscaler',
    verb: 'Enlarge a small image with AI',
    summary: 'Enlarge small or soft images 2× or 4×. The AI rebuilds edges and texture instead of stretching pixels.',
    input: 'image' as Input,
    shot: upscale,
  },
  {
    key: 'mockup',
    href: '/tools/mockup/',
    name: 'Mockup Generator',
    verb: 'Put a design on a screen or in print',
    summary: 'Browser, phone, laptop, business cards, posters and paper, with tilt, shadow and backgrounds.',
    input: 'image' as Input,
    shot: mockup,
  },
];

export const num = (n: number) => String(n).padStart(2, '0');
