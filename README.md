# Payback

Collective Bucket altında yolculuk harcamalarını kişiler arasında denkleştiren uygulama.

## Özellikler

- Yolculuk oluştur (giriş gerekir)
- Kişi ekle
- Harcama ekle (ödeyen, açıklama, tutar, dahil kişiler)
- Hesabı çıkar → kim kime ne verir
- Düzenleme ekranı yalnızca yolculuk sahibine açık
- Paylaşım linkinde herkese açık harcama ve hesap özeti

## Adresler

- Canlı: `https://payback.collectivebucket.com`
- Hosting site: `cbucket-payback`
- Düzenleme: `/y/{id}`
- Paylaşılan özet: `/s/{id}`

## Yerel

```bash
npm install
npm run check
npm run serve
```

## Veri

Firestore `trips` koleksiyonu. Tekil okuma herkese açık; listeleme ve yazma yalnızca
yolculuk sahibi (`ownerUid`).
