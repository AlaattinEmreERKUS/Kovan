// Kovan S0 spike
// R1: WebView2 icinde getDisplayMedia calisiyor mu (frontend tarafi)
// R2: global kisayol Windows'ta keyup (Released) tetikliyor mu (bu dosya)

#[cfg(desktop)]
use tauri::Emitter;
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    let builder = {
        let ptt = Shortcut::new(None, Code::F8);
        builder
            .plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, shortcut, event| {
                        if shortcut != &ptt {
                            return;
                        }
                        let state = match event.state() {
                            ShortcutState::Pressed => "Pressed",
                            ShortcutState::Released => "Released",
                        };
                        println!("[PTT] F8 state={state}");
                        let _ = app.emit("ptt", state);
                    })
                    .build(),
            )
            .setup(move |app| {
                app.global_shortcut().register(ptt)?;
                println!("[PTT] F8 kaydedildi. Pencere arka plandayken bas ve birak.");
                Ok(())
            })
    };

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
