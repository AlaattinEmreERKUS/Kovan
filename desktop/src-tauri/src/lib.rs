// Kovan masaustu — S6 Gorev 2: OLCUM KAPISI (R7).
//
// Sorulan tek soru: Tauri v2, kontrol etmedigi bir UZAK sayfaya IPC
// koprusunu enjekte ediyor mu? Spike bunu YEREL sayfada olcmustu
// (frontendDist: "../src"); uzak origin farkli bir soru.
//
// Bu dosya bilerek ASGARI: tek kisayol (F8), tek olay. Uc kisayol, komut
// yuzeyi ve tepsi Gorev 7 ve 9'da geliyor. Once kapinin gectigini gorelim.

#[cfg(desktop)]
use tauri::Emitter;
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};

/// Sayfaya yayilan olay govdesi. web/src/lib/masaustu.ts icindeki
/// `KisayolOlayi` ile birebir ayni alanlari tasir.
#[derive(Clone, serde::Serialize)]
struct KisayolOlayi {
    ad: String,
    durum: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = {
        let ptt = Shortcut::new(None, Code::F8);
        builder
            .plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, kisayol, event| {
                        if kisayol != &ptt {
                            return;
                        }
                        let durum = match event.state() {
                            ShortcutState::Pressed => "Pressed",
                            ShortcutState::Released => "Released",
                        };
                        // Konsol ciktisi Rust tarafinin tetiklendigini
                        // kanitlar; sayfada gorunmezse sorun IPC'dedir,
                        // kisayol kaydinda degil. Ikisini ayirmak icin.
                        println!("[olcum] F8 {durum}");
                        let _ = app.emit(
                            "kisayol",
                            KisayolOlayi {
                                ad: "ptt".into(),
                                durum: durum.into(),
                            },
                        );
                    })
                    .build(),
            )
            .setup(move |app| {
                app.global_shortcut().register(ptt)?;
                println!("[olcum] F8 kaydedildi. Baska pencereye tikla, bas ve birak.");
                Ok(())
            })
    };

    builder
        .run(tauri::generate_context!())
        .expect("Kovan baslatilamadi");
}
