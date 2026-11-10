#[cfg(all(feature = "native-smoke", not(debug_assertions)))]
compile_error!("native-smoke feature cannot be used in a release build");

pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(all(feature = "native-smoke", debug_assertions))]
    let builder = builder
        .plugin(tauri_plugin_wdio_webdriver::init())
        .setup(|_app| {
            let report_path = std::env::var("PEERCANVAS_NATIVE_SMOKE_ENV_FILE")?;
            std::fs::write(report_path, tauri::webview_version()?)?;
            Ok(())
        });

    builder
        .run(tauri::generate_context!())
        .expect("failed to run PeerCanvas");
}
