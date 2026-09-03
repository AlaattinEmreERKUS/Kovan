// Kovan masaustu. Rust HICBIR ses durumu tutmaz (K6): yalnizca global
// kisayolu kaydeder ve olayi sayfaya yayar. Mute/deafen kararinin tek
// sahibi web tarafindaki `voice` store'udur.

use std::sync::Mutex;

#[cfg(desktop)]
use tauri::Emitter;
use tauri::Manager;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().manage(KisayolHaritasi::default());

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
        .setup(|app| {
            // Uzak sayfada hata ayiklamanin tek yolu konsol; elle aranmasin.
            // Yalniz hata ayiklama derlemesinde, surum derlemesinde blok yok.
            #[cfg(debug_assertions)]
            if let Some(w) = app.get_webview_window("main") {
                w.open_devtools();
            }
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![kisayollari_ayarla])
        .run(tauri::generate_context!())
        .expect("Kovan baslatilamadi");
}
