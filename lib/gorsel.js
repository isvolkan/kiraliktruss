// Fotoğraf işleme: yüklenen resmi WebP'ye çevirir, iki boy üretir (tam ve küçük).
// Yönetim paneli yüklemede, scripts/gorselleri-isle.js eski kayıtlarda, /gorsel/:id eksik küçük boyda kullanır.
const sharp = require('sharp');

const TAM_EN_UZUN = 1600; // tam boyun en uzun kenarı (px)
const KUCUK_GENISLIK = 600; // küçük boyun genişliği (px), liste kartları için
const KALITE = 78;

// Dosyanın gerçekten JPEG / PNG / WebP olup olmadığını ilk baytlarına bakarak anlar
// (istemcinin söylediği dosya türüne güvenilmez).
async function imzaKontrol(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const webp = buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP';
  return jpeg || png || webp;
}

// Tek resimden iki WebP üretir. Büyütme yapılmaz; kameranın EXIF dönüklüğü düzeltilir (rotate).
async function hazirla(buffer) {
  const tam = await sharp(buffer).rotate()
    .resize({ width: TAM_EN_UZUN, height: TAM_EN_UZUN, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: KALITE }).toBuffer();
  const kucuk = await sharp(buffer).rotate()
    .resize({ width: KUCUK_GENISLIK, withoutEnlargement: true })
    .webp({ quality: KALITE }).toBuffer();
  return { tam, kucuk, tur: 'image/webp' };
}

module.exports = { hazirla, imzaKontrol };
