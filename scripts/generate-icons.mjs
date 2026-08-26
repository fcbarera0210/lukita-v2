import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const out = join(root, 'icons');
mkdirSync(out, { recursive: true });

const svg = readFileSync(join(root, 'icon.svg'));
await sharp(svg).resize(192, 192).png().toFile(join(out, 'icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(join(out, 'icon-512.png'));
await sharp(svg).resize(180, 180).png().toFile(join(out, 'apple-touch-icon.png'));

const maskable = svg.toString().replace('rx="96"', 'rx="0"');
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile(join(out, 'icon-512-maskable.png'));

console.log('icons ok');
