// Kovan masaustu. Rust HICBIR ses durumu tutmaz (K6): yalnizca global
// kisayolu kaydeder ve olayi sayfaya yayar. Mute/deafen kararinin tek
// sahibi web tarafindaki `voice` store'udur.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

#[cfg(desktop)]
use tauri::Emitter;
use tauri::Manager;
use tauri::webview::PageLoadEvent;
use tauri::WindowEvent;
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem};
#[cfg(desktop)]
use tauri::tray::TrayIconBuilder;
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Clone, serde::Serialize)]
struct KisayolOlayi {
    ad: String,
    durum: String,
}

#[derive(Clone, serde::Deserialize)]
struct Kisayollar {
    ptt: String,
    mik: String,
    kulaklik: String,
}

#[derive(Clone, serde::Serialize)]
struct KayitSonucu {
    ad: String,
    kayitli: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    sebep: Option<String>,
}

/// Kayitli kisayol -> ad eslemesi. Handler hangi ada karsilik geldigini
/// buradan okur; Shortcut'in kendisi ad tasimaz.
#[derive(Default)]
struct KisayolHaritasi(Mutex<Vec<(Shortcut, String)>>);

#[tauri::command]
fn kisayollari_ayarla(
    app: tauri::AppHandle,
    kisayollar: Kisayollar,
) -> Result<Vec<KayitSonucu>, String> {
    let gs = app.global_shortcut();
    let harita = app.state::<KisayolHaritasi>();

    // Once eskileri sok: kullanici tusu degistirdiginde eskisi calismaya
    // devam ederse iki tus ayni isi yapar.
    {
        let mut kilit = harita.0.lock().map_err(|e| e.to_string())?;
        for (kisayol, _) in kilit.iter() {
            let _ = gs.unregister(*kisayol);
        }
        kilit.clear();
    }

    let istekler = [
        ("ptt", kisayollar.ptt),
        ("mik", kisayollar.mik),
        ("kulaklik", kisayollar.kulaklik),
    ];

    let mut sonuclar = Vec::new();
    for (ad, tus) in istekler {
        match tus.parse::<Shortcut>() {
            Err(e) => sonuclar.push(KayitSonucu {
                ad: ad.into(),
                kayitli: false,
                sebep: Some(format!("Tus dizisi cozulemedi: {e}")),
            }),
            Ok(kisayol) => match gs.register(kisayol) {
                // Windows kaydi reddedince bas-konus SESSIZCE olurdu (K5).
                Err(e) => sonuclar.push(KayitSonucu {
                    ad: ad.into(),
                    kayitli: false,
                    sebep: Some(e.to_string()),
                }),
                Ok(()) => {
                    harita
                        .0
                        .lock()
                        .map_err(|e| e.to_string())?
                        .push((kisayol, ad.to_string()));
                    sonuclar.push(KayitSonucu { ad: ad.into(), kayitli: true, sebep: None });
                }
            },
        }
    }
    Ok(sonuclar)
}

/// Tepsi menusundeki mikrofon ogesi. Rust durumu TUTMAZ (K6): sayfa
/// degisince bildirir, burada yalniz metin guncellenir.
#[cfg(desktop)]
struct TepsiOgeleri(Mutex<Option<MenuItem<tauri::Wry>>>);

#[tauri::command]
fn mikrofon_etiketi(app: tauri::AppHandle, muted: bool) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let ogeler = app.state::<TepsiOgeleri>();
        let kilit = ogeler.0.lock().map_err(|e| e.to_string())?;
        if let Some(oge) = kilit.as_ref() {
            let metin = if muted { "Mikrofonu ac" } else { "Mikrofonu kapat" };
            oge.set_text(metin).map_err(|e| e.to_string())?;
        }
    }
    #[cfg(not(desktop))]
    let _ = (&app, muted);
    Ok(())
}

/// Uzak sayfa bir kez yuklendi mi. Ag yokken WebView2'nin kendi ingilizce
/// hata sayfasinda kalinmasin diye (R10) sureyi bu bayrak olcuyor.
static SAYFA_YUKLENDI: AtomicBool = AtomicBool::new(false);

/// Uzak sayfanin acilmasi icin tanidigimiz sure. Yavas baglantida erken
/// vazgecip "baglanilamadi" demek, gec vazgecmekten daha kotu.
const YUKLEME_SURESI: std::time::Duration = std::time::Duration::from_secs(20);

/// Yerel hata sayfasinin adresi. Windows'ta ozel semalar
/// `http://<sema>.localhost/` bicimine ceviriliyor.
#[cfg(windows)]
const HATA_ADRESI: &str = "http://kovan.localhost/hata";
#[cfg(not(windows))]
const HATA_ADRESI: &str = "kovan://localhost/hata";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().manage(KisayolHaritasi::default());

    // Tek ornek kilidi ILK eklenti olmali (Tauri'nin sarti). Iki pencere
    // iki WebSocket ve iki mikrofon demek olurdu.
    #[cfg(desktop)]
    let builder = builder
        .manage(TepsiOgeleri(Mutex::new(None)))
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(p) = app.get_webview_window("main") {
                let _ = p.show();
                let _ = p.unminimize();
                let _ = p.set_focus();
            }
        }));

    #[cfg(desktop)]
    let builder = builder.plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, kisayol, event| {
                let harita = app.state::<KisayolHaritasi>();
                let Ok(kilit) = harita.0.lock() else { return };
                let Some((_, ad)) = kilit.iter().find(|(k, _)| k == kisayol) else {
                    return;
                };
                let durum = match event.state() {
                    ShortcutState::Pressed => "Pressed",
                    ShortcutState::Released => "Released",
                };
                let _ = app.emit(
                    "kisayol",
                    KisayolOlayi { ad: ad.clone(), durum: durum.into() },
                );
            })
            .build(),
    );

    builder
        // Hata sayfasi uygulamanin icinde gomulu duruyor: ag yokken disaridan
        // bir sey cekmek zaten mumkun degil.
        .register_uri_scheme_protocol("kovan", |_ctx, _istek| {
            tauri::http::Response::builder()
                .header("Content-Type", "text/html; charset=utf-8")
                .body(include_str!("hata.html").as_bytes().to_vec())
                .expect("hata sayfasi")
        })
        .on_page_load(|_pencere, yuk| {
            if matches!(yuk.event(), PageLoadEvent::Finished) {
                SAYFA_YUKLENDI.store(true, Ordering::Relaxed);
            }
        })
        .setup(|app| {
            // Uzak sayfada hata ayiklamanin tek yolu konsol; elle aranmasin.
            // Yalniz hata ayiklama derlemesinde, surum derlemesinde blok yok.
            #[cfg(debug_assertions)]
            if let Some(w) = app.get_webview_window("main") {
                w.open_devtools();
            }
            // Uzak sayfa acilmadiysa kendi hata sayfamiza gec. WebView2 kendi
            // sayfasini gosterdiginde de Finished tetiklenebiliyor; o durumda
            // bu yakalamaz, bilinen sinir.
            let tutamac = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(YUKLEME_SURESI);
                if SAYFA_YUKLENDI.load(Ordering::Relaxed) {
                    return;
                }
                if let Some(p) = tutamac.get_webview_window("main") {
                    if let Ok(adres) = HATA_ADRESI.parse() {
                        let _ = p.navigate(adres);
                    }
                }
            });

            #[cfg(desktop)]
            {
                let goster = MenuItem::with_id(app, "goster", "Goster", true, None::<&str>)?;
                let mik = MenuItem::with_id(app, "mik", "Mikrofonu kapat", true, None::<&str>)?;
                let cik = MenuItem::with_id(app, "cik", "Cik", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&goster, &mik, &cik])?;

                app.state::<TepsiOgeleri>()
                    .0
                    .lock()
                    .expect("tepsi kilidi")
                    .replace(mik.clone());

                TrayIconBuilder::new()
                    .icon(app.default_window_icon().expect("pencere ikonu").clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "goster" => {
                            if let Some(p) = app.get_webview_window("main") {
                                let _ = p.show();
                                let _ = p.set_focus();
                            }
                        }
                        // Rust mute'u KENDI cevirmez; sayfaya soyler, karar orada.
                        "mik" => {
                            let _ = app.emit(
                                "kisayol",
                                KisayolOlayi { ad: "mik".into(), durum: "Pressed".into() },
                            );
                        }
                        "cik" => app.exit(0),
                        _ => {}
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .on_window_event(|pencere, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Kapatma SONLANDIRMAZ (K4): seste kalmak beklenen davranis.
                // Cikis yalniz tepsi menusunden.
                api.prevent_close();
                let _ = pencere.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![kisayollari_ayarla, mikrofon_etiketi])
        .run(tauri::generate_context!())
        .expect("Kovan baslatilamadi");
}
