#[cfg(all(feature = "native-smoke", not(debug_assertions)))]
compile_error!("native-smoke feature cannot be used in a release build");

mod persistence;

#[cfg(not(target_os = "linux"))]
use tauri::Emitter;

#[tauri::command]
fn quit_application(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg(not(target_os = "linux"))]
fn install_guarded_quit(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItemBuilder};

    let menu = Menu::default(app.handle())?;
    #[cfg(target_os = "macos")]
    let (submenu_id, quit_label) = {
        let name = app.package_info().name.clone();
        (name.clone(), format!("Quit {name}"))
    };
    #[cfg(target_os = "windows")]
    let (submenu_id, quit_label) = ("File".to_owned(), "Exit PeerCanvas".to_owned());

    let submenu = menu
        .items()?
        .iter()
        .find_map(|item| {
            let submenu = item.as_submenu()?;
            (submenu.text().ok().as_deref() == Some(submenu_id.as_str())).then(|| submenu.clone())
        })
        .ok_or_else(|| format!("default {submenu_id} menu was not created"))?;
    let quit_item = submenu
        .items()?
        .iter()
        .find_map(|item| {
            let predefined = item.as_predefined_menuitem()?;
            let text = predefined.text().ok()?;
            #[cfg(target_os = "macos")]
            let is_quit = text.trim_start_matches('&').starts_with("Quit");
            #[cfg(target_os = "windows")]
            let is_quit = text.trim_start_matches('&') == "Exit";
            is_quit.then(|| predefined.clone())
        })
        .ok_or_else(|| format!("default quit item was not found in {submenu_id}"))?;
    submenu.remove(&quit_item)?;

    let quit_item = MenuItemBuilder::with_id("peercanvas-quit", quit_label)
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;
    submenu.append(&quit_item)?;
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        if event.id() == "peercanvas-quit" {
            let _ = app.emit("peercanvas-quit-requested", ());
        }
    });

    Ok(())
}

pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(persistence::PersistenceState::default())
        .invoke_handler(tauri::generate_handler![
            persistence::load_recent_document,
            persistence::get_recent_document_name,
            persistence::open_document,
            persistence::accept_open,
            persistence::discard_open,
            persistence::save_document,
            persistence::close_document,
            quit_application,
        ]);

    #[cfg(not(target_os = "linux"))]
    let builder = builder.setup(install_guarded_quit);

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
