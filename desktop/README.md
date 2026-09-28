# Kovan masaüstü

Tauri 2 kabuğu. İçindeki arayüz **paketlenmiş bir kopya değil**, doğrudan
canlı site: pencere `https://kovan-web.pages.dev` adresini açar. Web'e yapılan
her deploy masaüstüne de anında iner, `.msi` yeniden dağıtılmaz.

`.msi` yalnızca şunlar değişince yeniden çıkarılır: Rust tarafı (kısayollar,
tepsi, pencere davranışı), ikon, sürüm numarası, ya da canlı adres.

## Ne yapıyor

- **Global kısayollar.** Başka pencere odaktayken de çalışır: `F8` bas-konuş,
  `F9` mikrofon, `F10` kulaklık. Kullanıcı ayarlardan değiştirebilir.
  Rust hiçbir ses durumu tutmaz — yalnız tuşa basıldığını sayfaya haber verir,
  mute/deafen kararının tek sahibi web tarafındaki `voice` store'u.
- **Tepsi.** Pencereyi kapatmak uygulamayı kapatmaz, tepsiye indirir; ses
  kesilmez. Çıkış yalnız tepsi menüsündeki "Cik" ile.
- **Tek örnek.** İkinci kez çalıştırılırsa yeni pencere açılmaz, mevcut olan
  öne gelir. İki pencere iki WebSocket ve iki mikrofon demek olurdu.
- **Ağ yoksa.** Uzak sayfa 20 saniyede açılmazsa gömülü hata sayfasına geçer
  (`src-tauri/src/hata.html`), "Yeniden dene" düğmesi var.

## Geliştirme

```bash
cd desktop && npm run dev
```

`beforeDevCommand` web dev sunucusunu kendi kaldırır (`dev:web`). API için
ayrıca `cd server && npm run dev` gerekir (127.0.0.1:8787).

Hata ayıklama derlemesinde DevTools kendiliğinden açılır; sürüm derlemesinde
o blok hiç yoktur.

## Sürüm çıkarma

```bash
cd desktop && npm run build
```

Çıktı: `src-tauri/target/release/bundle/msi/Kovan_<sürüm>_x64_en-US.msi`

WebView2 kurulu değilse yükleyici indirip kurar
(`webviewInstallMode: downloadBootstrapper`) — Windows 10'un eski
sürümlerinde WebView2 hazır gelmiyor.

## Dağıtım

`.msi` **Cloudflare Pages'ten** dağıtılıyor: dosya `web/static/indir/` altına
konur ve web deploy'uyla birlikte yayına girer.

```
https://kovan-web.pages.dev/indir/Kovan_0.1.0_x64_en-US.msi
```

Neden bu yol: arkadaşların GitHub hesabı ve private repo erişimi gerekmiyor,
tek link yetiyor. Bedeli: `.msi` depoya giriyor (~5-10 MB) ve sürüm geçmişi
tutulmuyor — yeni sürüm eskisinin üzerine yazılıyor. Sürüm sayısı artarsa
GitHub Releases'e taşımak gerekir.

### SmartScreen uyarısı — arkadaşlara söylenecek

`.msi` **imzasız**. Kod imzalama sertifikası yıllık ücretli, dört kişi için
alınmadı. Windows ilk çalıştırmada mavi bir ekranla
**"Windows bilgisayarınızı korudu"** diyecek.

Yapılacak: **Ek bilgi** → **Yine de çalıştır**.

Bu uyarı "virüs bulundu" demek değil; "bu yayıncıyı tanımıyorum" demek.
İmzalanana kadar her yeni sürümde çıkacak.

## İkon

Kovan'ın kendi ikonu. Kaynak SVG'ler `ikon/` altında. Yeniden üretmek için:

```bash
cd desktop && npx tauri icon ikon/<seçilen>.png
```
