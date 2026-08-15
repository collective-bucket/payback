# Payback

Collective Bucket altında yolculuk harcamalarını kişiler arasında denkleştiren uygulama.

## Özellikler

- Yolculuk oluştur (giriş gerekir)
- Kişi ekle
- Harcama ekle (ödeyen, açıklama, tutar, dahil kişiler)
- Hesabı çıkar → kim kime ne verir
- Paylaşım linki ile herkese açık okuma

## Adresler

- Canlı: `https://payback.collectivebucket.com`
- Hosting site: `cbucket-payback`
- Yolculuk: `/y/{id}`

## Yerel

```bash
npm install
npm run check
npm run serve
```

## Veri

Firestore `trips` koleksiyonu. Tekil okuma herkese açık; listeleme ve yazma yalnızca
yolculuk sahibi (`ownerUid`).
