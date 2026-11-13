#[cfg(all(feature = "native-smoke", not(debug_assertions)))]
compile_error!("native-smoke feature cannot be used in a release build");

mod drawio;
mod interchange;
mod messages;
mod persistence;

#[cfg(not(target_os = "linux"))]
use tauri::Emitter;

#[tauri::command]
fn quit_application(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn set_interface_locale(
    app: tauri::AppHandle,
    locale: persistence::LocalePreference,
) -> persistence::NativeResult<()> {
    #[cfg(not(target_os = "linux"))]
    {
        let menu = app
            .menu()
            .ok_or_else(|| messages::NativeMessage::new("native.menuUnavailable"))?;
        let quit_item = menu
            .items()
            .ok()
            .and_then(|items| {
                items.into_iter().find_map(|item| {
                    let submenu = item.as_submenu()?;
                    submenu.items().ok()?.into_iter().find_map(|item| {
                        let menu_item = item.as_menuitem()?;
                        (menu_item.id().as_ref() == "peercanvas-quit").then(|| menu_item.clone())
                    })
                })
            })
            .ok_or_else(|| messages::NativeMessage::new("native.menuUnavailable"))?;
        #[cfg(target_os = "macos")]
        let label = if locale == persistence::LocalePreference::Es {
            "Salir de PeerCanvas"
        } else {
            "Quit PeerCanvas"
        };
        #[cfg(target_os = "windows")]
        let label = if locale == persistence::LocalePreference::Es {
            "Salir de PeerCanvas"
        } else {
            "Exit PeerCanvas"
        };
        quit_item
            .set_text(label)
            .map_err(|_| messages::NativeMessage::new("native.menuUpdateFailed"))?;
    }
    #[cfg(target_os = "linux")]
    let _ = (app, locale);
    Ok(())
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
        .manage(interchange::InterchangeState::default())
        .invoke_handler(tauri::generate_handler![
            persistence::load_recent_document,
            persistence::get_recent_document_name,
            persistence::get_preferences,
            persistence::update_preferences,
            persistence::open_document,
            persistence::accept_open,
            persistence::discard_open,
            persistence::save_document,
            persistence::close_document,
            set_interface_locale,
            interchange::import_drawio,
            interchange::prepare_drawio_export,
            interchange::export_drawio,
            interchange::discard_drawio_export,
            quit_application,
        ]);

    #[cfg(not(target_os = "linux"))]
    let builder = builder.setup(install_guarded_quit);

    #[cfg(all(feature = "native-smoke", debug_assertions))]
    let builder = builder
        .plugin(tauri_plugin_wdio_webdriver::init())
        .setup(|_app| {
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;
                use webkit2gtk::{SettingsExt, WebViewExt};

                let webview = _app
                    .get_webview_window("main")
                    .ok_or_else(|| std::io::Error::other("main smoke window was not found"))?;
                webview.with_webview(|webview| {
                    if let Some(settings) = webview.inner().settings() {
                        settings.set_enable_webrtc(true);
                    }
                })?;
            }

            let report_path = std::env::var("PEERCANVAS_NATIVE_SMOKE_ENV_FILE")?;
            std::fs::write(report_path, tauri::webview_version()?)?;
            Ok(())
        });

    builder
        .run(tauri::generate_context!())
        .expect("failed to run PeerCanvas");
}
