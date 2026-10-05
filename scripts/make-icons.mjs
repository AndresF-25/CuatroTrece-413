// Genera los íconos de 413 a partir del logo original (líneas oscuras sobre fondo claro):
//   - quita el color de fondo (queda transparente) conservando solo el trazo y el "413";
//   - crea versiones oscura y clara del logo para la interfaz;
//   - crea build/icon.ico (ejecutable e instalador) y resources/icon.png (ventana).
//
// Uso:  node scripts/make-icons.mjs [--ico=light|dark]
//   --ico=light (por defecto) → trazo blanco, se ve bien en barra de tareas oscura
//   --ico=dark                → trazo negro, para Windows en modo claro

import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(root, 'branding', 'source', 'logo-base.jpg')
const icoVariant = (process.argv.find((a) => a.startsWith('--ico=')) ?? '--ico=light').slice(6)

const INK = { dark: [26, 26, 26], light: [255, 255, 255] }

// ---------- 1. Máscara (alfa) del trazo ----------
const { data, info } = await sharp(SOURCE).greyscale().raw().toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height

// Brillo del papel (percentil alto) y del trazo (percentil bajo)
const sorted = Uint8Array.from(data).sort()
const paper = sorted[Math.floor(sorted.length * 0.8)]
const ink = sorted[Math.floor(sorted.length * 0.002)]

const mask = new Float32Array(W * H)
for (let i = 0; i < mask.length; i++) {
  let a = (paper - data[i]) / (paper - ink)
  a = (a - 0.12) / 0.7 // descarta la textura del papel y endurece el trazo
  mask[i] = Math.min(1, Math.max(0, a))
}

function rowsWithInk(m) {
  const rows = []
  for (let y = 0; y < H; y++) {
    let has = false
    for (let x = 0; x < W && !has; x++) has = m[y * W + x] > 0.5
    rows.push(has)
  }
  return rows
}

function bbox(m, y0 = 0, y1 = H) {
  let minX = W, maxX = 0, minY = H, maxY = 0
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < W; x++)
      if (m[y * W + x] > 0.5) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  return { minX, maxX, minY, maxY }
}

// Separa el símbolo (círculo + 43) del texto "413": busca el mayor hueco vertical
const rows = rowsWithInk(mask)
const full = bbox(mask)
let gapStart = 0, gapLen = 0, bestStart = 0, bestLen = 0
// Solo huecos dentro del logo (los márgenes de arriba y abajo no cuentan)
for (let y = full.minY; y <= full.maxY; y++) {
  if (!rows[y]) {
    if (gapLen === 0) gapStart = y
    gapLen++
    if (gapLen > bestLen) { bestLen = gapLen; bestStart = gapStart }
  } else gapLen = 0
}
const splitY = bestStart + Math.floor(bestLen / 2)
const markOnly = bbox(mask, 0, splitY)

// ---------- 2. Utilidades ----------
function dilate(src, r) {
  if (r <= 0) return src
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let m = 0
      for (let k = Math.max(0, x - r); k <= Math.min(W - 1, x + r); k++) m = Math.max(m, src[y * W + k])
      tmp[y * W + x] = m
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let m = 0
      for (let k = Math.max(0, y - r); k <= Math.min(H - 1, y + r); k++) m = Math.max(m, tmp[k * W + x])
      out[y * W + x] = m
    }
  return out
}

/** PNG transparente: recorta `box`, lo centra en un lienzo `canvasW×canvasH` con margen `pad`. */
async function render({ m, box, color, canvasW, canvasH, pad = 0.1 }) {
  const rgba = Buffer.alloc(W * H * 4)
  for (let i = 0; i < m.length; i++) {
    rgba[i * 4] = color[0]
    rgba[i * 4 + 1] = color[1]
    rgba[i * 4 + 2] = color[2]
    rgba[i * 4 + 3] = Math.round(m[i] * 255)
  }
  const cw = box.maxX - box.minX + 1
  const ch = box.maxY - box.minY + 1
  const cropped = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: box.minX, top: box.minY, width: cw, height: ch })
    .toBuffer()
  const maxW = Math.round(canvasW * (1 - pad * 2))
  const maxH = Math.round(canvasH * (1 - pad * 2))
  const scale = Math.min(maxW / cw, maxH / ch)
  const w = Math.max(1, Math.round(cw * scale))
  const h = Math.max(1, Math.round(ch * scale))
  const resized = await sharp(cropped, { raw: { width: cw, height: ch, channels: 4 } })
    .resize(w, h, { kernel: 'lanczos3' })
    .png()
    .toBuffer()
  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: resized, left: Math.round((canvasW - w) / 2), top: Math.round((canvasH - h) / 2) }])
    .png()
    .toBuffer()
}

const write = (rel, buf) => {
  const file = join(root, rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, buf)
  console.log('✓', rel)
}

// ---------- 3. Logos para la interfaz (sin fondo) ----------
for (const variant of ['dark', 'light']) {
  const buf = await render({ m: mask, box: full, color: INK[variant], canvasW: 480, canvasH: 560, pad: 0.04 })
  write(`src/renderer/src/assets/logo-${variant}.png`, buf)
}
write('branding/logo-dark-transparent.png', await render({ m: mask, box: full, color: INK.dark, canvasW: 1024, canvasH: 1024, pad: 0.08 }))
write('branding/logo-light-transparent.png', await render({ m: mask, box: full, color: INK.light, canvasW: 1024, canvasH: 1024, pad: 0.08 }))

// ---------- 4. Ícono de la aplicación ----------
const color = INK[icoVariant === 'dark' ? 'dark' : 'light']
write('build/icon.png', await render({ m: mask, box: full, color, canvasW: 1024, canvasH: 1024, pad: 0.07 }))
write('resources/icon.png', await render({ m: mask, box: full, color, canvasW: 512, canvasH: 512, pad: 0.07 }))

// Tamaños pequeños: el trazo fino y el "413" no se leen a 16–32 px, así que ahí se usa solo el
// símbolo con el trazo engrosado. Desde 48 px se usa el logo completo.
const SIZES = [16, 24, 32, 48, 64, 128, 256]
const pngs = []
for (const size of SIZES) {
  const small = size <= 32
  const grow = size <= 24 ? 16 : size <= 32 ? 11 : size <= 48 ? 6 : size <= 64 ? 4 : 0
  const m = dilate(mask, grow)
  const box = small ? bbox(m, 0, splitY) : bbox(m)
  const png = await render({ m, box: small ? markOnly : { ...box }, color, canvasW: size, canvasH: size, pad: small ? 0.06 : 0.07 })
  pngs.push(png)
  write(`branding/ico-sizes/icon-${size}.png`, png)
}
write('build/icon.ico', await pngToIco(pngs))
console.log(`Listo (ico: ${icoVariant}). Símbolo/texto separados en y=${splitY}.`)
