use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::{Path, PathBuf},
    sync::{
        Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::SystemTime,
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

const MAX_BYTES: u64 = 10 * 1024 * 1024;
static TEMP_ID: AtomicU64 = AtomicU64::new(0);
type Result<T> = std::result::Result<T, String>;

#[derive(Default)]
pub struct PersistenceState(Mutex<Store>);

#[derive(Default)]
struct Store {
    current: Option<(PathBuf, Snapshot)>,
    recovered_source: Option<PathBuf>,
    pending: Option<Pending>,
    next_token: u64,
}

struct Pending {
    token: String,
    path: PathBuf,
    primary: Option<Snapshot>,
    backup: Option<Snapshot>,
}

#[derive(Debug, PartialEq, Eq)]
struct Snapshot {
    text: String,
    modified: Option<SystemTime>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenCandidate {
    token: String,
    display_name: String,
    primary_text: Option<String>,
    backup_text: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOutcome {
    display_name: String,
    warning: Option<String>,
    recent_updated: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OpenSource {
    Primary,
    Backup,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Preferences {
    last_document: Option<PathBuf>,
}

fn io_error(error: io::Error) -> String {
    match error.kind() {
        io::ErrorKind::PermissionDenied => "Permission denied. Choose a writable location.",
        io::ErrorKind::NotFound => {
            "The document is unavailable. Open it again or choose another file."
        }
        io::ErrorKind::AlreadyExists => {
            "The document changed outside PeerCanvas. Open it again or use Save As."
        }
        _ => "The file operation failed. Your last complete document or backup was retained.",
    }
    .into()
}

fn sibling(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(suffix);
    PathBuf::from(name)
}

fn display_name(path: &Path) -> String {
    path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned()
}

fn document_path(path: PathBuf) -> Result<PathBuf> {
    if !path
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("peercanvas"))
    {
        return Err("Choose a .peercanvas document.".into());
    }
    if path.exists() {
        fs::canonicalize(path).map_err(io_error)
    } else {
        let parent = fs::canonicalize(path.parent().ok_or("Choose a valid document location.")?)
            .map_err(io_error)?;
        Ok(parent.join(path.file_name().ok_or("Choose a valid document name.")?))
    }
}

fn read_snapshot(path: &Path) -> Result<Snapshot> {
    let file = File::open(path).map_err(io_error)?;
    let metadata = file.metadata().map_err(io_error)?;
    if !metadata.is_file() {
        return Err("Choose a regular document file.".into());
    }
    if metadata.len() > MAX_BYTES {
        return Err("The document exceeds the 10 MiB limit.".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(io_error)?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err("The document exceeds the 10 MiB limit.".into());
    }
    Ok(Snapshot {
        text: String::from_utf8(bytes)
            .map_err(|_| "The document is not valid UTF-8.".to_string())?,
        modified: metadata.modified().ok(),
    })
}

fn unchanged(path: &Path, expected: Option<&Snapshot>) -> Result<()> {
    let matches = match expected {
        Some(snapshot) => read_snapshot(path).is_ok_and(|current| current == *snapshot),
        None => {
            matches!(fs::symlink_metadata(path), Err(error) if error.kind() == io::ErrorKind::NotFound)
        }
    };
    if matches {
        Ok(())
    } else {
        Err("The document changed outside PeerCanvas. Open it again or use Save As.".into())
    }
}

fn sync_parent(path: &Path) -> io::Result<()> {
    // Windows does not support opening directories through std::fs::File.
    #[cfg(unix)]
    File::open(
        path.parent()
            .ok_or_else(|| io::Error::other("missing parent"))?,
    )?
    .sync_all()?;
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

fn publish(
    path: &Path,
    text: &str,
    expected: Option<&Snapshot>,
    before_publish: impl FnOnce() -> io::Result<()>,
) -> Result<Option<String>> {
    if text.len() as u64 > MAX_BYTES {
        return Err("The document exceeds the 10 MiB limit.".into());
    }
    serde_json::from_str::<serde_json::Value>(text)
        .map_err(|_| "The document is not valid JSON.".to_string())?;
    unchanged(path, expected)?;
    let temporary = sibling(
        path,
        &format!(
            ".{}.{}.tmp",
            std::process::id(),
            TEMP_ID.fetch_add(1, Ordering::Relaxed)
        ),
    );
    let backup = sibling(path, ".bak");
    let mut rotated = false;
    let mut owns_temporary = false;
    let staged = (|| -> Result<()> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(io_error)?;
        owns_temporary = true;
        if expected.is_some() {
            file.set_permissions(fs::metadata(path).map_err(io_error)?.permissions())
                .map_err(io_error)?;
        }
        file.write_all(text.as_bytes()).map_err(io_error)?;
        file.sync_all().map_err(io_error)?;
        unchanged(path, expected)?;
        if expected.is_some() {
            // Retire the old backup while the complete primary still exists.
            match fs::remove_file(&backup) {
                Ok(()) => (),
                Err(error) if error.kind() == io::ErrorKind::NotFound => (),
                Err(error) => return Err(io_error(error)),
            }
            unchanged(path, expected)?;
            fs::rename(path, &backup).map_err(io_error)?;
            rotated = true;
            sync_parent(path).map_err(io_error)?;
            unchanged(&backup, expected)?;
        }
        before_publish().map_err(io_error)?;
        unchanged(path, None)?;
        // shortcut: std::fs has no atomic compare-and-rename; use platform primitives if simultaneous writers must be coordinated.
        fs::rename(&temporary, path).map_err(io_error)?;
        Ok(())
    })();
    if let Err(error) = staged {
        if rotated {
            // Only attempt rollback while the original location is absent.
            if unchanged(path, None).is_ok() && fs::rename(&backup, path).is_ok() {
                let _ = sync_parent(path);
            }
        }
        if owns_temporary {
            let _ = fs::remove_file(&temporary);
        }
        return Err(error);
    }
    let durable = sync_parent(path).is_ok();
    let _ = fs::remove_file(&temporary);
    Ok((!durable)
        .then(|| "Saved, but the filesystem could not confirm directory durability.".into()))
}

fn preferences_path(app: &tauri::AppHandle) -> Result<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("preferences.json"))
        .map_err(|_| "Application preferences are unavailable.".into())
}

fn remember(path: &Path, last_document: Option<PathBuf>) -> Result<()> {
    fs::create_dir_all(
        path.parent()
            .ok_or("Application preferences are unavailable.")?,
    )
    .map_err(io_error)?;
    let text = serde_json::to_string(&Preferences { last_document })
        .map_err(|_| "Application preferences are unavailable.".to_string())?;
    let prior = match read_snapshot(path) {
        Ok(snapshot) => Some(snapshot),
        Err(_) if !path.exists() => None,
        Err(error) => return Err(error),
    };
    publish(path, &text, prior.as_ref(), || Ok(())).map(|_| ())
}

fn read_preferences(path: &Path) -> Result<Option<Preferences>> {
    let mut found = false;
    let mut last_error = None;
    for candidate in [path.to_path_buf(), sibling(path, ".bak")] {
        if !candidate.exists() {
            continue;
        }
        found = true;
        match read_snapshot(&candidate).and_then(|snapshot| {
            serde_json::from_str(&snapshot.text)
                .map_err(|_| "The recent document preference is invalid. Use Open instead.".into())
        }) {
            Ok(preferences) => return Ok(Some(preferences)),
            Err(error) => last_error = Some(error),
        }
    }
    if found {
        Err(last_error.unwrap_or_else(|| "Application preferences are unavailable.".into()))
    } else {
        Ok(None)
    }
}

impl Store {
    fn stage_open(&mut self, path: PathBuf) -> Result<OpenCandidate> {
        let primary_result = read_snapshot(&path);
        let backup = read_snapshot(&sibling(&path, ".bak")).ok();
        let primary = match primary_result {
            Ok(snapshot) => Some(snapshot),
            Err(error) if backup.is_none() => return Err(error),
            Err(_) => None,
        };
        self.next_token += 1;
        let token = self.next_token.to_string();
        let candidate = OpenCandidate {
            token: token.clone(),
            display_name: display_name(&path),
            primary_text: primary.as_ref().map(|snapshot| snapshot.text.clone()),
            backup_text: backup.as_ref().map(|snapshot| snapshot.text.clone()),
        };
        self.pending = Some(Pending {
            token,
            path,
            primary,
            backup,
        });
        Ok(candidate)
    }

    fn accept(&mut self, token: &str, source: OpenSource, preferences: &Path) -> Result<bool> {
        let pending = self
            .pending
            .as_ref()
            .filter(|pending| pending.token == token)
            .ok_or("The open request expired. Open the document again.")?;
        let recent_updated = match source {
            OpenSource::Primary => {
                let primary = pending
                    .primary
                    .as_ref()
                    .ok_or("The primary document is unavailable.")?;
                unchanged(&pending.path, Some(primary))?;
                let primary = Snapshot {
                    text: primary.text.clone(),
                    modified: primary.modified,
                };
                self.current = Some((pending.path.clone(), primary));
                self.recovered_source = None;
                // Opening remains valid if its recent-file preference cannot be updated.
                remember(preferences, Some(pending.path.clone())).is_ok()
            }
            OpenSource::Backup => {
                let backup = pending
                    .backup
                    .as_ref()
                    .ok_or("The backup document is unavailable.")?;
                unchanged(&sibling(&pending.path, ".bak"), Some(backup))?;
                self.current = None;
                self.recovered_source = Some(pending.path.clone());
                false
            }
        };
        self.pending = None;
        Ok(recent_updated)
    }

    fn save(&mut self, path: PathBuf, contents: &str, preferences: &Path) -> Result<SaveOutcome> {
        if self.recovered_source.as_ref() == Some(&path) {
            return Err(
                "Save the recovered document to a different file to preserve the original.".into(),
            );
        }
        let expected = self
            .current
            .as_ref()
            .filter(|(current_path, _)| *current_path == path)
            .map(|(_, snapshot)| snapshot);
        if expected.is_none() && path.exists() {
            return Err(
                "That filename already exists. Choose a different filename for Save As.".into(),
            );
        }
        let mut warning = publish(&path, contents, expected, || Ok(()))?;
        let snapshot = read_snapshot(&path)?;
        if snapshot.text != contents {
            return Err(
                "The document changed outside PeerCanvas. Open it again or use Save As.".into(),
            );
        }
        self.current = Some((path.clone(), snapshot));
        self.recovered_source = None;
        let recent_updated = remember(preferences, Some(path.clone())).is_ok();
        if !recent_updated {
            warning =
                Some("Saved, but the recent document preference could not be updated.".into());
        }
        Ok(SaveOutcome {
            display_name: display_name(&path),
            warning,
            recent_updated,
        })
    }
}

async fn with_store<T: Send + 'static>(
    app: tauri::AppHandle,
    action: impl FnOnce(&tauri::AppHandle, &mut Store) -> Result<T> + Send + 'static,
) -> Result<T> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<PersistenceState>();
        let mut store = state
            .0
            .lock()
            .map_err(|_| "Document storage is unavailable. Restart PeerCanvas.".to_string())?;
        action(&app, &mut store)
    })
    .await
    .map_err(|_| "The file operation could not finish.".to_string())?
}

#[tauri::command]
pub async fn get_recent_document_name(app: tauri::AppHandle) -> Result<Option<String>> {
    with_store(app, |app, _| {
        let path = preferences_path(app)?;
        Ok(read_preferences(&path)?
            .and_then(|preferences| preferences.last_document)
            .map(|path| display_name(&path)))
    })
    .await
}

#[tauri::command]
pub async fn load_recent_document(app: tauri::AppHandle) -> Result<Option<OpenCandidate>> {
    with_store(app, |app, store| {
        let path = preferences_path(app)?;
        read_preferences(&path)?
            .and_then(|preferences| preferences.last_document)
            .map(|path| document_path(path).and_then(|path| store.stage_open(path)))
            .transpose()
    })
    .await
}

#[tauri::command]
pub async fn open_document(app: tauri::AppHandle) -> Result<Option<OpenCandidate>> {
    with_store(app, |app, store| {
        app.dialog()
            .file()
            .add_filter("PeerCanvas", &["peercanvas"])
            .blocking_pick_file()
            .map(|path| {
                path.into_path()
                    .map_err(|_| "Choose a local document file.".to_string())
                    .and_then(document_path)
                    .and_then(|path| store.stage_open(path))
            })
            .transpose()
    })
    .await
}

#[tauri::command]
pub async fn accept_open(app: tauri::AppHandle, token: String, source: OpenSource) -> Result<bool> {
    with_store(app, move |app, store| {
        store.accept(&token, source, &preferences_path(app)?)
    })
    .await
}

#[tauri::command]
pub async fn discard_open(app: tauri::AppHandle, token: String) -> Result<()> {
    with_store(app, move |_, store| {
        if store
            .pending
            .as_ref()
            .is_some_and(|pending| pending.token == token)
        {
            store.pending = None;
        }
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn save_document(
    app: tauri::AppHandle,
    contents: String,
    save_as: bool,
) -> Result<Option<SaveOutcome>> {
    with_store(app, move |app, store| {
        let target = if !save_as && store.current.is_some() {
            store.current.as_ref().map(|(path, _)| path.clone())
        } else {
            app.dialog()
                .file()
                .set_file_name("Untitled.peercanvas")
                .blocking_save_file()
                .map(|path| {
                    path.into_path()
                        .map_err(|_| "Choose a local document file.".to_string())
                })
                .transpose()?
                .map(|path| {
                    if path.extension().is_none() {
                        path.with_extension("peercanvas")
                    } else {
                        path
                    }
                })
        };
        target
            .map(|path| {
                document_path(path)
                    .and_then(|path| store.save(path, &contents, &preferences_path(app)?))
            })
            .transpose()
    })
    .await
}

#[tauri::command]
pub async fn close_document(app: tauri::AppHandle) -> Result<()> {
    with_store(app, |_, store| {
        store.current = None;
        store.recovered_source = None;
        store.pending = None;
        Ok(())
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!(
                "peercanvas-store-test-{}-{}",
                std::process::id(),
                TEMP_ID.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&root).unwrap();
            Self(root)
        }
        fn document(&self) -> PathBuf {
            self.0.join("diagram.peercanvas")
        }
        fn preferences(&self) -> PathBuf {
            self.0.join("app-data/preferences.json")
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    const FIRST: &str = "{\"schemaVersion\":1,\"title\":\"first\"}";
    const SECOND: &str = "{\"schemaVersion\":1,\"title\":\"second\"}";

    #[test]
    fn new_save_and_reopen_use_separate_preferences() {
        let fixture = Fixture::new();
        let mut store = Store::default();
        let path = fixture.document();
        store
            .save(path.clone(), FIRST, &fixture.preferences())
            .unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), FIRST);
        assert!(!sibling(&path, ".bak").exists());
        let preferences: Preferences =
            serde_json::from_str(&fs::read_to_string(fixture.preferences()).unwrap()).unwrap();
        assert_eq!(preferences.last_document, Some(path.clone()));
        let opened = store.stage_open(path).unwrap();
        assert_eq!(opened.primary_text.as_deref(), Some(FIRST));
        assert_eq!(opened.backup_text, None);
        remember(&fixture.preferences(), None).unwrap();
        assert_eq!(fs::read_to_string(fixture.document()).unwrap(), FIRST);
    }

    #[test]
    fn recent_document_preferences_fall_back_to_last_complete_backup() {
        let fixture = Fixture::new();
        let preferences_path = fixture.preferences();
        let first = fixture.0.join("first.peercanvas");
        let second = fixture.0.join("second.peercanvas");
        remember(&preferences_path, Some(first.clone())).unwrap();
        remember(&preferences_path, Some(second)).unwrap();

        fs::write(&preferences_path, "{broken").unwrap();

        let preferences = read_preferences(&preferences_path).unwrap().unwrap();
        assert_eq!(preferences.last_document, Some(first.clone()));

        fs::remove_file(preferences_path).unwrap();
        let preferences = read_preferences(&fixture.preferences()).unwrap().unwrap();
        assert_eq!(preferences.last_document, Some(first));
    }

    #[test]
    fn overwrite_retains_only_prior_complete_version() {
        let fixture = Fixture::new();
        let mut store = Store::default();
        let path = fixture.document();
        store
            .save(path.clone(), FIRST, &fixture.preferences())
            .unwrap();
        let mut previous = FIRST;
        for next in [SECOND, FIRST, SECOND, FIRST] {
            store
                .save(path.clone(), next, &fixture.preferences())
                .unwrap();
            assert_eq!(fs::read_to_string(&path).unwrap(), next);
            assert_eq!(
                fs::read_to_string(sibling(&path, ".bak")).unwrap(),
                previous
            );
            previous = next;
        }
        assert!(fs::read_dir(&fixture.0).unwrap().all(|entry| {
            !entry
                .unwrap()
                .path()
                .extension()
                .is_some_and(|extension| extension == "tmp")
        }));
    }

    #[test]
    fn failed_publication_rolls_back_without_partial_data() {
        let fixture = Fixture::new();
        let path = fixture.document();
        fs::write(&path, FIRST).unwrap();
        fs::write(sibling(&path, ".bak"), "{\"older\":true}").unwrap();
        let snapshot = read_snapshot(&path).unwrap();
        let error = publish(&path, SECOND, Some(&snapshot), || {
            Err(io::Error::other("injected interruption"))
        });
        assert!(error.is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), FIRST);
        assert!(!fs::read_dir(&fixture.0).unwrap().any(|entry| {
            entry
                .unwrap()
                .path()
                .extension()
                .is_some_and(|extension| extension == "tmp")
        }));
    }

    #[test]
    fn failed_backup_retirement_keeps_complete_primary() {
        let fixture = Fixture::new();
        let path = fixture.document();
        fs::write(&path, FIRST).unwrap();
        fs::create_dir(sibling(&path, ".bak")).unwrap();
        let snapshot = read_snapshot(&path).unwrap();
        assert!(publish(&path, SECOND, Some(&snapshot), || Ok(())).is_err());
        assert_eq!(fs::read_to_string(path).unwrap(), FIRST);
    }

    #[test]
    fn interrupted_publication_recovers_backup_without_touching_original() {
        let fixture = Fixture::new();
        let path = fixture.document();
        // State after process termination between backup rotation and publication.
        fs::write(sibling(&path, ".bak"), FIRST).unwrap();
        fs::write(sibling(&path, ".interrupted.tmp"), "{incomplete").unwrap();
        let mut store = Store::default();
        let opened = store.stage_open(path.clone()).unwrap();
        assert_eq!(opened.primary_text, None);
        assert_eq!(opened.backup_text.as_deref(), Some(FIRST));
        store
            .accept(&opened.token, OpenSource::Backup, &fixture.preferences())
            .unwrap();
        assert!(store.current.is_none());
        assert!(
            store
                .save(path.clone(), FIRST, &fixture.preferences())
                .is_err()
        );
        let recovered = fixture.0.join("recovered.peercanvas");
        store
            .save(recovered.clone(), FIRST, &fixture.preferences())
            .unwrap();
        assert!(!path.exists());
        assert_eq!(fs::read_to_string(recovered).unwrap(), FIRST);
        assert_eq!(fs::read_to_string(sibling(&path, ".bak")).unwrap(), FIRST);
    }

    #[test]
    fn corrupt_primary_is_presented_for_canonical_validation_and_backup_is_safe() {
        let fixture = Fixture::new();
        let path = fixture.document();
        fs::write(&path, "{broken").unwrap();
        fs::write(sibling(&path, ".bak"), FIRST).unwrap();
        let mut store = Store::default();
        let opened = store.stage_open(path.clone()).unwrap();
        assert_eq!(opened.primary_text.as_deref(), Some("{broken"));
        store
            .accept(&opened.token, OpenSource::Backup, &fixture.preferences())
            .unwrap();
        assert!(
            store
                .save(path.clone(), SECOND, &fixture.preferences())
                .is_err()
        );
        assert_eq!(fs::read_to_string(path).unwrap(), "{broken");
    }

    #[test]
    fn invalid_utf8_and_oversize_reads_and_writes_are_bounded() {
        let fixture = Fixture::new();
        let path = fixture.document();
        fs::write(&path, [0xff, 0xfe]).unwrap();
        assert!(read_snapshot(&path).unwrap_err().contains("UTF-8"));
        File::create(&path).unwrap().set_len(MAX_BYTES + 1).unwrap();
        assert!(read_snapshot(&path).unwrap_err().contains("10 MiB"));
        assert!(Store::default().stage_open(path.clone()).is_err());
        fs::write(sibling(&path, ".bak"), FIRST).unwrap();
        let opened = Store::default().stage_open(path.clone()).unwrap();
        assert_eq!(opened.primary_text, None);
        assert_eq!(opened.backup_text.as_deref(), Some(FIRST));
        let target = fixture.0.join("large.peercanvas");
        assert!(
            publish(
                &target,
                &" ".repeat(MAX_BYTES as usize + 1),
                None,
                || Ok(())
            )
            .is_err()
        );
        assert!(!target.exists());
        assert!(publish(&target, "{broken", None, || Ok(())).is_err());
        assert!(!target.exists());
    }

    #[test]
    fn external_change_and_late_publication_conflict_never_overwrite() {
        let fixture = Fixture::new();
        let path = fixture.document();
        let mut store = Store::default();
        store
            .save(path.clone(), FIRST, &fixture.preferences())
            .unwrap();
        fs::write(&path, SECOND).unwrap();
        let error = store
            .save(path.clone(), FIRST, &fixture.preferences())
            .err()
            .unwrap();
        assert!(error.contains("changed outside"));
        assert!(!error.contains(path.to_str().unwrap()));
        assert_eq!(fs::read_to_string(&path).unwrap(), SECOND);
        let snapshot = read_snapshot(&path).unwrap();
        assert!(
            publish(&path, FIRST, Some(&snapshot), || fs::write(
                &path, "external"
            ))
            .is_err()
        );
        assert_eq!(fs::read_to_string(&path).unwrap(), "external");
        assert_eq!(fs::read_to_string(sibling(&path, ".bak")).unwrap(), SECOND);
    }

    #[test]
    fn stale_open_and_changed_candidate_preserve_active_document() {
        let fixture = Fixture::new();
        let path = fixture.document();
        let mut store = Store::default();
        store
            .save(path.clone(), FIRST, &fixture.preferences())
            .unwrap();
        let opened = store.stage_open(path.clone()).unwrap();
        assert!(
            store
                .accept("invalid token", OpenSource::Primary, &fixture.preferences())
                .is_err()
        );
        fs::write(&path, SECOND).unwrap();
        assert!(
            store
                .accept(&opened.token, OpenSource::Primary, &fixture.preferences())
                .is_err()
        );
        assert_eq!(store.current.as_ref().unwrap().1.text, FIRST);
    }

    #[test]
    fn save_as_preserves_original_and_pending_replacement() {
        let fixture = Fixture::new();
        let original = fixture.document();
        let replacement = fixture.0.join("replacement.peercanvas");
        let saved_copy = fixture.0.join("copy.peercanvas");
        let mut store = Store::default();
        store
            .save(original.clone(), FIRST, &fixture.preferences())
            .unwrap();
        fs::write(&replacement, SECOND).unwrap();
        let opened = store.stage_open(replacement.clone()).unwrap();
        store
            .save(saved_copy.clone(), SECOND, &fixture.preferences())
            .unwrap();
        assert_eq!(fs::read_to_string(original).unwrap(), FIRST);
        assert_eq!(fs::read_to_string(saved_copy).unwrap(), SECOND);
        store
            .accept(&opened.token, OpenSource::Primary, &fixture.preferences())
            .unwrap();
        assert_eq!(store.current.as_ref().unwrap().0, replacement);
    }

    #[test]
    fn save_as_refuses_existing_different_destination_without_mutation() {
        let fixture = Fixture::new();
        let original = fixture.document();
        let destination = fixture.0.join("existing.peercanvas");
        let mut store = Store::default();
        store
            .save(original.clone(), FIRST, &fixture.preferences())
            .unwrap();
        fs::write(&destination, SECOND).unwrap();
        fs::write(sibling(&destination, ".bak"), FIRST).unwrap();
        let error = store
            .save(destination.clone(), FIRST, &fixture.preferences())
            .err()
            .unwrap();
        assert!(error.contains("already exists"));
        assert_eq!(fs::read_to_string(&original).unwrap(), FIRST);
        assert_eq!(fs::read_to_string(&destination).unwrap(), SECOND);
        assert_eq!(
            fs::read_to_string(sibling(&destination, ".bak")).unwrap(),
            FIRST
        );
        assert_eq!(store.current.as_ref().unwrap().0, original);
        let preferences: Preferences =
            serde_json::from_str(&fs::read_to_string(fixture.preferences()).unwrap()).unwrap();
        assert_eq!(preferences.last_document, Some(original));
    }

    #[test]
    fn permission_failure_at_publish_keeps_complete_source_and_safe_error() {
        let fixture = Fixture::new();
        let path = fixture.document();
        fs::write(&path, FIRST).unwrap();
        let snapshot = read_snapshot(&path).unwrap();
        let error = publish(&path, SECOND, Some(&snapshot), || {
            Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "private filesystem detail",
            ))
        })
        .unwrap_err();
        assert_eq!(error, "Permission denied. Choose a writable location.");
        assert_eq!(fs::read_to_string(path).unwrap(), FIRST);
    }

    #[test]
    fn preference_failure_is_a_successful_save_with_warning() {
        let fixture = Fixture::new();
        let path = fixture.document();
        let preferences = fixture.0.join("not-a-directory/preferences.json");
        fs::write(preferences.parent().unwrap(), "blocked").unwrap();
        let outcome = Store::default()
            .save(path.clone(), FIRST, &preferences)
            .unwrap();
        assert!(outcome.warning.is_some());
        assert_eq!(fs::read_to_string(path).unwrap(), FIRST);
    }
}
