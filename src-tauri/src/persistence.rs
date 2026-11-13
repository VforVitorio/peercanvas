use crate::messages::{self, NativeMessage};
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
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

const MAX_BYTES: u64 = 10 * 1024 * 1024;
static TEMP_ID: AtomicU64 = AtomicU64::new(0);
type Result<T> = std::result::Result<T, String>;
pub type NativeResult<T> = std::result::Result<T, NativeMessage>;

pub fn native_error(error: String) -> NativeMessage {
    messages::from_text(&error)
}

pub fn native_result<T>(result: Result<T>) -> NativeResult<T> {
    result.map_err(native_error)
}

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
    warning: Option<NativeMessage>,
    recent_updated: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawioSaveOutcome {
    display_name: String,
    warning: Option<NativeMessage>,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OpenSource {
    Primary,
    Backup,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Preferences {
    #[serde(default)]
    last_document: Option<PathBuf>,
    #[serde(default)]
    theme: Option<ThemePreference>,
    #[serde(default)]
    locale: Option<LocalePreference>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemePreference {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LocalePreference {
    En,
    Es,
}

#[derive(Clone, Copy, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PreferencesPatch {
    pub theme: Option<ThemePreference>,
    pub locale: Option<LocalePreference>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferencesResponse {
    pub theme: ThemePreference,
    pub locale: Option<LocalePreference>,
    pub warning: Option<NativeMessage>,
}

#[derive(Default)]
struct PreferenceRead {
    preferences: Preferences,
    exists: bool,
    source: Option<PathBuf>,
    warning: Option<NativeMessage>,
    legacy: bool,
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

fn drawio_path(mut path: PathBuf) -> Result<PathBuf> {
    if path.extension().is_none() {
        path.set_extension("drawio");
    }
    if !path.extension().is_some_and(|extension| {
        extension.eq_ignore_ascii_case("drawio") || extension.eq_ignore_ascii_case("xml")
    }) {
        return Err("Choose a .drawio or .xml export file.".into());
    }
    match fs::symlink_metadata(&path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            Err("Choose a regular file, not a symbolic link.".into())
        }
        Ok(metadata) if !metadata.is_file() => Err("Choose a regular file.".into()),
        Ok(_) => fs::canonicalize(path).map_err(io_error),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            let parent = fs::canonicalize(path.parent().ok_or("Choose a valid export location.")?)
                .map_err(io_error)?;
            Ok(parent.join(path.file_name().ok_or("Choose a valid export name.")?))
        }
        Err(error) => Err(io_error(error)),
    }
}

pub async fn export_drawio_file(
    app: tauri::AppHandle,
    contents: String,
    locale: LocalePreference,
) -> Result<Option<DrawioSaveOutcome>> {
    with_store(app, move |app, _| {
        let spanish = locale == LocalePreference::Es;
        let selected = app
            .dialog()
            .file()
            .add_filter("draw.io", &["drawio", "xml"])
            .set_file_name(if spanish {
                "Diagrama.drawio"
            } else {
                "Diagram.drawio"
            })
            .blocking_save_file()
            .map(|path| {
                path.into_path()
                    .map_err(|_| "Choose a local export file.".to_string())
            })
            .transpose()?;
        let Some(selected) = selected else {
            return Ok(None);
        };
        let path = drawio_path(selected)?;
        let expected = match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err("Choose a regular file, not a symbolic link.".into());
            }
            Ok(metadata) if !metadata.is_file() => return Err("Choose a regular file.".into()),
            Ok(_) => Some(read_snapshot(&path)?),
            Err(error) if error.kind() == io::ErrorKind::NotFound => None,
            Err(error) => return Err(io_error(error)),
        };
        if expected.is_some()
            && !app
                .dialog()
                .message(if spanish {
                    "Ya existe un archivo con este nombre. ¿Quieres reemplazarlo?"
                } else {
                    "A file with this name already exists. Replace it?"
                })
                .title(if spanish {
                    "¿Reemplazar el archivo existente?"
                } else {
                    "Replace existing file?"
                })
                .kind(MessageDialogKind::Warning)
                .buttons(MessageDialogButtons::OkCancelCustom(
                    (if spanish { "Reemplazar" } else { "Replace" }).into(),
                    (if spanish { "Cancelar" } else { "Cancel" }).into(),
                ))
                .blocking_show()
        {
            return Ok(None);
        }
        let warning = publish_with_validator(
            &path,
            &contents,
            expected.as_ref(),
            || Ok(()),
            crate::drawio::validate_drawio_xml,
            false,
        )?;
        Ok(Some(DrawioSaveOutcome {
            display_name: display_name(&path),
            warning: warning.as_deref().map(messages::from_text),
        }))
    })
    .await
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
        Some(snapshot) => {
            matches!(
                fs::symlink_metadata(path),
                Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink()
            ) && read_snapshot(path).is_ok_and(|current| current == *snapshot)
        }
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
    publish_with_validator(
        path,
        text,
        expected,
        before_publish,
        |value| {
            serde_json::from_str::<serde_json::Value>(value)
                .map(|_| ())
                .map_err(|_| "The document is not valid JSON.".to_string())
        },
        true,
    )
}

fn publish_with_validator(
    path: &Path,
    text: &str,
    expected: Option<&Snapshot>,
    before_publish: impl FnOnce() -> io::Result<()>,
    validate_content: impl FnOnce(&str) -> Result<()>,
    keep_backup: bool,
) -> Result<Option<String>> {
    publish_with_validator_and_sync(
        path,
        text,
        expected,
        before_publish,
        validate_content,
        keep_backup,
        sync_parent,
    )
}

fn publish_with_validator_and_sync(
    path: &Path,
    text: &str,
    expected: Option<&Snapshot>,
    before_publish: impl FnOnce() -> io::Result<()>,
    validate_content: impl FnOnce(&str) -> Result<()>,
    keep_backup: bool,
    sync_directory: impl Fn(&Path) -> io::Result<()>,
) -> Result<Option<String>> {
    if text.len() as u64 > MAX_BYTES {
        return Err("The document exceeds the 10 MiB limit.".into());
    }
    validate_content(text)?;
    unchanged(path, expected)?;
    let temporary_id = TEMP_ID.fetch_add(1, Ordering::Relaxed);
    let temporary = sibling(
        path,
        &format!(".{}.{}.tmp", std::process::id(), temporary_id),
    );
    let backup = if keep_backup {
        sibling(path, ".bak")
    } else {
        sibling(
            path,
            &format!(".{}.{}.bak", std::process::id(), temporary_id),
        )
    };
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
            if keep_backup {
                // Retire the old recovery snapshot while the complete primary still exists.
                match fs::remove_file(&backup) {
                    Ok(()) => (),
                    Err(error) if error.kind() == io::ErrorKind::NotFound => (),
                    Err(error) => return Err(io_error(error)),
                }
            } else if fs::symlink_metadata(&backup).is_ok() {
                return Err(
                    "The temporary export backup already exists. Try another destination.".into(),
                );
            }
            unchanged(path, expected)?;
            fs::rename(path, &backup).map_err(io_error)?;
            rotated = true;
            sync_directory(path).map_err(io_error)?;
            unchanged(&backup, expected)?;
        }
        before_publish().map_err(io_error)?;
        unchanged(path, None)?;
        if keep_backup {
            // shortcut: document saves use std::fs rename; coordinate concurrent writers with platform primitives if needed.
            fs::rename(&temporary, path).map_err(io_error)?;
        } else {
            fs::hard_link(&temporary, path).map_err(io_error)?;
        }
        Ok(())
    })();
    if let Err(error) = staged {
        let backup_retained =
            rotated && (unchanged(path, None).is_err() || fs::rename(&backup, path).is_err());
        if rotated && !backup_retained {
            let _ = sync_directory(path);
        }
        if owns_temporary {
            let _ = fs::remove_file(&temporary);
        }
        return Err(if backup_retained {
            "Export failed; the previous file remains in a recovery backup in the same folder."
                .into()
        } else {
            error
        });
    }
    let durable = sync_directory(path).is_ok();
    let _ = fs::remove_file(&temporary);
    let mut warning = (!durable)
        .then(|| "Saved, but the filesystem could not confirm directory durability.".to_string());
    if rotated && !keep_backup {
        if let Err(error) = fs::remove_file(&backup) {
            if error.kind() != io::ErrorKind::NotFound {
                warning.get_or_insert_with(|| {
                    "Exported, but the previous file backup remains.".into()
                });
            }
        } else if sync_directory(path).is_err() {
            warning.get_or_insert_with(|| {
                "Exported, but the filesystem could not confirm directory durability.".into()
            });
        }
    }
    Ok(warning)
}

fn preferences_path(app: &tauri::AppHandle) -> Result<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("preferences.json"))
        .map_err(|_| "Application preferences are unavailable.".into())
}

fn remember(path: &Path, last_document: Option<PathBuf>) -> Result<Option<NativeMessage>> {
    let mut preferences = read_preferences_state(path).preferences;
    preferences.last_document = last_document;
    write_preferences(path, &preferences)
}

fn read_preferences(path: &Path) -> Result<Option<Preferences>> {
    let loaded = read_preferences_state(path);
    Ok(loaded.exists.then_some(loaded.preferences))
}

/// Read primary then the atomic-write backup. Damaged preference data never
/// blocks document Open; defaults are returned with a renderer-safe warning.
fn read_preferences_state(path: &Path) -> PreferenceRead {
    let mut found = false;
    let mut had_failure = false;
    for candidate in [
        path.to_path_buf(),
        sibling(path, ".bak"),
        sibling(path, ".recovery.bak"),
        sibling(path, ".migration.bak"),
    ] {
        if !candidate.exists() {
            continue;
        }
        found = true;
        let Ok(snapshot) = read_snapshot(&candidate) else {
            had_failure = true;
            continue;
        };
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&snapshot.text) else {
            had_failure = true;
            continue;
        };
        let legacy = value.get("theme").is_none() || value.get("locale").is_none();
        let mut value = value;
        let mut sanitized = false;
        if let Some(object) = value.as_object_mut() {
            if object
                .keys()
                .any(|key| !["lastDocument", "theme", "locale"].contains(&key.as_str()))
            {
                had_failure = true;
                continue;
            }
            for key in ["theme", "locale"] {
                if object.get(key).is_some_and(|value| {
                    !value.is_null() && !value.is_string()
                        || (key == "theme"
                            && value
                                .as_str()
                                .is_some_and(|value| !["system", "light", "dark"].contains(&value)))
                        || (key == "locale"
                            && value
                                .as_str()
                                .is_some_and(|value| !["en", "es"].contains(&value)))
                }) {
                    object.insert(key.to_owned(), serde_json::Value::Null);
                    sanitized = true;
                }
            }
            if object
                .get("lastDocument")
                .is_some_and(|value| !value.is_null() && !value.is_string())
            {
                object.insert("lastDocument".into(), serde_json::Value::Null);
                sanitized = true;
            }
        }
        let Ok(preferences) = serde_json::from_value::<Preferences>(value) else {
            had_failure = true;
            continue;
        };
        let recovered = candidate.as_path() != path || had_failure || sanitized;
        let warning = recovered.then(|| NativeMessage::new("preferences.recovered"));
        return PreferenceRead {
            preferences,
            exists: true,
            source: Some(candidate),
            warning,
            legacy,
        };
    }
    PreferenceRead {
        preferences: Preferences::default(),
        exists: found,
        source: None,
        warning: found.then(|| NativeMessage::new("preferences.reset")),
        legacy: false,
    }
}

/// Keep the pre-preferences-schema file available for rollback. This backup
/// is created once and is never rotated by subsequent preference writes.
fn preserve_legacy_preferences(path: &Path, loaded: &PreferenceRead) -> Result<()> {
    if !loaded.legacy {
        return Ok(());
    }
    let Some(source) = loaded.source.as_ref() else {
        return Ok(());
    };
    preserve_preferences_file(path, source, ".migration.bak")
}

/// Preserve the recovered valid copy before publish rotates the ordinary
/// `.bak` file. A temporary sibling is synced before an atomic hard link makes
/// the backup visible, so an interrupted copy can never look like a backup.
fn preserve_recovered_preferences(path: &Path, loaded: &PreferenceRead) -> Result<()> {
    if loaded.source.as_deref() == Some(path) || !loaded.exists {
        return Ok(());
    }
    let Some(source) = loaded.source.as_ref() else {
        return Ok(());
    };
    preserve_preferences_file(path, source, ".recovery.bak")
}

fn preserve_preferences_file(path: &Path, source: &Path, suffix: &str) -> Result<()> {
    let parent = path
        .parent()
        .ok_or("Application preferences are unavailable.")?;
    fs::create_dir_all(parent).map_err(io_error)?;
    let source_snapshot = read_snapshot(source)?;
    let backup = sibling(path, suffix);
    if backup.exists() {
        if read_snapshot(&backup).is_ok_and(|snapshot| snapshot == source_snapshot) {
            return Ok(());
        }
        // The recovered source stays intact until this replacement is fully
        // published. If interrupted after removal, it remains available at
        // `source`; in particular, a valid ordinary `.bak` is not rotated
        // until this staged replacement has been synced and linked.
        fs::remove_file(&backup).map_err(io_error)?;
    }
    let temporary = sibling(
        &backup,
        &format!(
            ".{}.{}.tmp",
            std::process::id(),
            TEMP_ID.fetch_add(1, Ordering::Relaxed)
        ),
    );
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(io_error)?;
    let result = (|| -> Result<()> {
        output
            .set_permissions(fs::metadata(source).map_err(io_error)?.permissions())
            .map_err(io_error)?;
        output
            .write_all(source_snapshot.text.as_bytes())
            .map_err(io_error)?;
        output.sync_all().map_err(io_error)?;
        match fs::hard_link(&temporary, &backup) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => Ok(()),
            Err(error) => Err(io_error(error)),
        }
    })();
    let _ = fs::remove_file(&temporary);
    result?;
    sync_parent(path).map_err(io_error)
}

fn write_preferences(path: &Path, preferences: &Preferences) -> Result<Option<NativeMessage>> {
    write_preferences_with_sync(path, preferences, sync_parent)
}

fn write_preferences_with_sync(
    path: &Path,
    preferences: &Preferences,
    sync_directory: impl Fn(&Path) -> io::Result<()>,
) -> Result<Option<NativeMessage>> {
    let loaded = read_preferences_state(path);
    preserve_legacy_preferences(path, &loaded)?;
    preserve_recovered_preferences(path, &loaded)?;
    let parent = path
        .parent()
        .ok_or("Application preferences are unavailable.")?;
    fs::create_dir_all(parent).map_err(io_error)?;
    let text = serde_json::to_string(preferences)
        .map_err(|_| "Application preferences are unavailable.".to_string())?;
    // Capture even a malformed but readable primary so publication can
    // compare-and-replace it without racing a concurrent writer.
    let prior = read_snapshot(path).ok();
    publish_with_validator_and_sync(
        path,
        &text,
        prior.as_ref(),
        || Ok(()),
        |value| {
            serde_json::from_str::<serde_json::Value>(value)
                .map(|_| ())
                .map_err(|_| "The document is not valid JSON.".to_string())
        },
        true,
        sync_directory,
    )
    .map(|warning| warning.as_deref().map(messages::from_text))
}

fn apply_preferences_patch(path: &Path, patch: PreferencesPatch) -> PreferencesResponse {
    let read = read_preferences_state(path);
    let mut preferences = read.preferences;
    if let Some(theme) = patch.theme {
        preferences.theme = Some(theme);
    }
    if let Some(locale) = patch.locale {
        preferences.locale = Some(locale);
    }
    let warning = match write_preferences(path, &preferences) {
        Ok(Some(warning)) => Some(warning),
        Ok(None) => read.warning,
        Err(_) => Some(NativeMessage::new("preferences.writeFailed")),
    };
    PreferencesResponse {
        theme: preferences.theme.unwrap_or_default(),
        locale: preferences.locale,
        warning,
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
        let mut warning = publish(&path, contents, expected, || Ok(()))?
            .as_deref()
            .map(messages::from_text);
        let snapshot = read_snapshot(&path)?;
        if snapshot.text != contents {
            return Err(
                "The document changed outside PeerCanvas. Open it again or use Save As.".into(),
            );
        }
        self.current = Some((path.clone(), snapshot));
        self.recovered_source = None;
        let recent_result = remember(preferences, Some(path.clone()));
        let recent_updated = recent_result.is_ok();
        match recent_result {
            Ok(Some(preference_warning)) if warning.is_none() => {
                warning = Some(preference_warning);
            }
            Err(_) => {
                warning = Some(messages::from_text(
                    "Saved, but the recent document preference could not be updated.",
                ));
            }
            _ => {}
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
pub async fn get_recent_document_name(app: tauri::AppHandle) -> NativeResult<Option<String>> {
    native_result(
        with_store(app, |app, _| {
            let path = preferences_path(app)?;
            Ok(read_preferences(&path)?
                .and_then(|preferences| preferences.last_document)
                .map(|path| display_name(&path)))
        })
        .await,
    )
}

#[tauri::command]
pub async fn load_recent_document(app: tauri::AppHandle) -> NativeResult<Option<OpenCandidate>> {
    native_result(
        with_store(app, |app, store| {
            let path = preferences_path(app)?;
            read_preferences(&path)?
                .and_then(|preferences| preferences.last_document)
                .map(|path| document_path(path).and_then(|path| store.stage_open(path)))
                .transpose()
        })
        .await,
    )
}

#[tauri::command]
pub async fn open_document(app: tauri::AppHandle) -> NativeResult<Option<OpenCandidate>> {
    native_result(
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
        .await,
    )
}

#[tauri::command]
pub async fn accept_open(
    app: tauri::AppHandle,
    token: String,
    source: OpenSource,
) -> NativeResult<bool> {
    native_result(
        with_store(app, move |app, store| {
            store.accept(&token, source, &preferences_path(app)?)
        })
        .await,
    )
}

#[tauri::command]
pub async fn discard_open(app: tauri::AppHandle, token: String) -> NativeResult<()> {
    native_result(
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
        .await,
    )
}

#[tauri::command]
pub async fn save_document(
    app: tauri::AppHandle,
    contents: String,
    save_as: bool,
    locale: LocalePreference,
) -> NativeResult<Option<SaveOutcome>> {
    native_result(
        with_store(app, move |app, store| {
            let target = if !save_as && store.current.is_some() {
                store.current.as_ref().map(|(path, _)| path.clone())
            } else {
                app.dialog()
                    .file()
                    .set_file_name(if locale == LocalePreference::Es {
                        "Sin título.peercanvas"
                    } else {
                        "Untitled.peercanvas"
                    })
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
        .await,
    )
}

#[tauri::command]
pub async fn close_document(app: tauri::AppHandle) -> NativeResult<()> {
    native_result(
        with_store(app, |_, store| {
            store.current = None;
            store.recovered_source = None;
            store.pending = None;
            Ok(())
        })
        .await,
    )
}

#[tauri::command]
pub async fn get_preferences(app: tauri::AppHandle) -> NativeResult<PreferencesResponse> {
    native_result(
        with_store(app, |app, _| {
            let read = read_preferences_state(&preferences_path(app)?);
            Ok(PreferencesResponse {
                theme: read.preferences.theme.unwrap_or_default(),
                locale: read.preferences.locale,
                warning: read.warning,
            })
        })
        .await,
    )
}

#[tauri::command]
pub async fn update_preferences(
    app: tauri::AppHandle,
    patch: PreferencesPatch,
) -> NativeResult<PreferencesResponse> {
    native_result(
        with_store(app, move |app, _| {
            Ok(apply_preferences_patch(&preferences_path(app)?, patch))
        })
        .await,
    )
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
    fn preference_upgrade_preserves_last_document_and_keeps_rollback_copy() {
        let fixture = Fixture::new();
        let path = fixture.preferences();
        let recent = fixture.0.join("existing.peercanvas");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        let original = serde_json::json!({ "lastDocument": recent }).to_string();
        fs::write(&path, &original).unwrap();

        let result = apply_preferences_patch(
            &path,
            PreferencesPatch {
                theme: Some(ThemePreference::Dark),
                locale: None,
            },
        );
        assert_eq!(result.theme, ThemePreference::Dark);
        assert_eq!(result.locale, None);
        let saved: Preferences = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(saved.last_document, Some(recent.clone()));
        assert_eq!(saved.theme, Some(ThemePreference::Dark));
        assert_eq!(
            fs::read_to_string(sibling(&path, ".migration.bak")).unwrap(),
            original
        );

        apply_preferences_patch(
            &path,
            PreferencesPatch {
                theme: None,
                locale: Some(LocalePreference::Es),
            },
        );
        remember(&path, Some(recent.clone())).unwrap();
        let saved: Preferences = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(saved.last_document, Some(recent));
        assert_eq!(saved.theme, Some(ThemePreference::Dark));
        assert_eq!(saved.locale, Some(LocalePreference::Es));
        assert_eq!(
            fs::read_to_string(sibling(&path, ".migration.bak")).unwrap(),
            original
        );
    }

    #[test]
    fn preferences_recover_backup_and_sanitize_bad_enum_values() {
        let fixture = Fixture::new();
        let path = fixture.preferences();
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "{broken").unwrap();
        let recent = fixture.0.join("recent.peercanvas");
        let backup = Preferences {
            last_document: Some(recent.clone()),
            theme: Some(ThemePreference::Dark),
            locale: Some(LocalePreference::Es),
        };
        fs::write(
            sibling(&path, ".bak"),
            serde_json::to_string(&backup).unwrap(),
        )
        .unwrap();
        let recovered = read_preferences_state(&path);
        assert_eq!(recovered.preferences.last_document, Some(recent.clone()));
        assert_eq!(recovered.preferences.theme, Some(ThemePreference::Dark));
        assert_eq!(recovered.preferences.locale, Some(LocalePreference::Es));
        assert_eq!(recovered.warning.unwrap().code, "preferences.recovered");

        fs::remove_file(sibling(&path, ".bak")).unwrap();
        fs::write(
            &path,
            serde_json::json!({
                "lastDocument": recent,
                "theme": "ultraviolet",
                "locale": "fr"
            })
            .to_string(),
        )
        .unwrap();
        let sanitized = read_preferences_state(&path);
        assert_eq!(sanitized.preferences.last_document, Some(recent));
        assert_eq!(sanitized.preferences.theme, None);
        assert_eq!(sanitized.preferences.locale, None);
        assert_eq!(sanitized.warning.unwrap().code, "preferences.recovered");
    }

    #[test]
    fn recovered_valid_backup_survives_replacement_of_corrupt_primary() {
        let fixture = Fixture::new();
        let path = fixture.preferences();
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "{broken primary").unwrap();
        let recent = fixture.0.join("recovered.peercanvas");
        let valid = Preferences {
            last_document: Some(recent.clone()),
            theme: Some(ThemePreference::Light),
            locale: Some(LocalePreference::En),
        };
        let valid_text = serde_json::to_string(&valid).unwrap();
        fs::write(sibling(&path, ".bak"), &valid_text).unwrap();

        let response = apply_preferences_patch(
            &path,
            PreferencesPatch {
                theme: Some(ThemePreference::Dark),
                locale: None,
            },
        );
        assert_eq!(response.theme, ThemePreference::Dark);
        assert_eq!(response.warning.unwrap().code, "preferences.recovered");
        assert_eq!(
            fs::read_to_string(sibling(&path, ".recovery.bak")).unwrap(),
            valid_text
        );

        fs::write(&path, "{damaged again").unwrap();
        fs::write(sibling(&path, ".bak"), "{also damaged").unwrap();
        let recovered = read_preferences_state(&path);
        assert_eq!(recovered.preferences.last_document, Some(recent));
        assert_eq!(recovered.preferences.theme, Some(ThemePreference::Light));
        assert_eq!(recovered.preferences.locale, Some(LocalePreference::En));
        assert_eq!(recovered.warning.unwrap().code, "preferences.recovered");
    }

    #[test]
    fn newest_backup_replaces_stale_recovery_before_primary_rotation() {
        let fixture = Fixture::new();
        let path = fixture.preferences();
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "{broken primary").unwrap();
        let stale = Preferences {
            last_document: Some(fixture.0.join("stale.peercanvas")),
            theme: Some(ThemePreference::Light),
            locale: Some(LocalePreference::En),
        };
        let newest = Preferences {
            last_document: Some(fixture.0.join("newest.peercanvas")),
            theme: Some(ThemePreference::Dark),
            locale: Some(LocalePreference::Es),
        };
        fs::write(
            sibling(&path, ".recovery.bak"),
            serde_json::to_string(&stale).unwrap(),
        )
        .unwrap();
        let newest_text = serde_json::to_string(&newest).unwrap();
        fs::write(sibling(&path, ".bak"), &newest_text).unwrap();

        apply_preferences_patch(
            &path,
            PreferencesPatch {
                theme: Some(ThemePreference::System),
                locale: None,
            },
        );

        assert_eq!(
            fs::read_to_string(sibling(&path, ".recovery.bak")).unwrap(),
            newest_text
        );
        fs::write(&path, "{interrupted publication").unwrap();
        fs::write(sibling(&path, ".bak"), "{corrupt rotated primary").unwrap();
        let recovered = read_preferences_state(&path);
        assert_eq!(recovered.preferences.last_document, newest.last_document);
        assert_eq!(recovered.preferences.theme, Some(ThemePreference::Dark));
        assert_eq!(recovered.preferences.locale, Some(LocalePreference::Es));
    }

    #[test]
    fn preference_directory_sync_failure_is_returned_as_a_warning() {
        let fixture = Fixture::new();
        let path = fixture.preferences();
        let result = write_preferences_with_sync(
            &path,
            &Preferences {
                theme: Some(ThemePreference::Dark),
                ..Preferences::default()
            },
            |_| Err(io::Error::other("simulated directory sync failure")),
        )
        .unwrap();
        assert_eq!(
            result.unwrap().code,
            "file.directoryNotDurable",
            "successful publication must retain its durability warning"
        );
        assert!(path.exists());
    }

    #[cfg(unix)]
    #[test]
    fn preference_migration_and_recovery_copies_keep_source_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let fixture = Fixture::new();
        let path = fixture.preferences();
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        let recent = fixture.0.join("old.peercanvas");
        fs::write(
            &path,
            serde_json::json!({ "lastDocument": recent }).to_string(),
        )
        .unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
        apply_preferences_patch(
            &path,
            PreferencesPatch {
                theme: Some(ThemePreference::Dark),
                locale: None,
            },
        );
        assert_eq!(
            fs::metadata(sibling(&path, ".migration.bak"))
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );

        fs::write(&path, "{corrupt primary").unwrap();
        let backup = sibling(&path, ".bak");
        fs::set_permissions(&backup, fs::Permissions::from_mode(0o600)).unwrap();
        apply_preferences_patch(
            &path,
            PreferencesPatch {
                theme: Some(ThemePreference::Light),
                locale: None,
            },
        );
        assert_eq!(
            fs::metadata(sibling(&path, ".recovery.bak"))
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
    }

    #[test]
    fn consecutive_preference_and_recent_document_updates_are_serialized() {
        let fixture = Fixture::new();
        let path = fixture.preferences();
        let recent = fixture.0.join("recent.peercanvas");
        let state = std::sync::Arc::new(Mutex::new(Store::default()));
        let mut workers = Vec::new();
        for index in 0..24 {
            let path = path.clone();
            let recent = recent.clone();
            let state = state.clone();
            workers.push(std::thread::spawn(move || {
                let _guard = state.lock().unwrap();
                if index % 3 == 0 {
                    remember(&path, Some(recent)).unwrap();
                } else if index % 2 == 0 {
                    apply_preferences_patch(
                        &path,
                        PreferencesPatch {
                            theme: Some(ThemePreference::Dark),
                            locale: None,
                        },
                    );
                } else {
                    apply_preferences_patch(
                        &path,
                        PreferencesPatch {
                            theme: None,
                            locale: Some(LocalePreference::Es),
                        },
                    );
                }
            }));
        }
        for worker in workers {
            worker.join().unwrap();
        }
        let saved: Preferences = serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
        assert_eq!(saved.last_document, Some(recent));
        assert_eq!(saved.theme, Some(ThemePreference::Dark));
        assert_eq!(saved.locale, Some(LocalePreference::Es));
    }

    #[test]
    fn failed_preference_write_returns_the_session_choice_and_warning() {
        let fixture = Fixture::new();
        let blocked_parent = fixture.0.join("not-a-directory");
        fs::write(&blocked_parent, "blocked").unwrap();
        let response = apply_preferences_patch(
            &blocked_parent.join("preferences.json"),
            PreferencesPatch {
                theme: Some(ThemePreference::Light),
                locale: Some(LocalePreference::Es),
            },
        );
        assert_eq!(response.theme, ThemePreference::Light);
        assert_eq!(response.locale, Some(LocalePreference::Es));
        assert_eq!(response.warning.unwrap().code, "preferences.writeFailed");
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
    fn failed_drawio_export_restores_the_destination_without_touching_existing_backup() {
        let fixture = Fixture::new();
        let path = fixture.0.join("diagram.drawio");
        let backup = sibling(&path, ".bak");
        fs::write(&path, FIRST).unwrap();
        fs::write(&backup, "unrelated backup").unwrap();
        let snapshot = read_snapshot(&path).unwrap();

        let error = publish_with_validator(
            &path,
            SECOND,
            Some(&snapshot),
            || Err(io::Error::other("injected interruption")),
            |_| Ok(()),
            false,
        );

        assert!(error.is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), FIRST);
        assert_eq!(fs::read_to_string(&backup).unwrap(), "unrelated backup");
        assert_eq!(
            fs::read_dir(&fixture.0)
                .unwrap()
                .filter_map(|entry| entry.ok())
                .filter(|entry| entry.path().extension().is_some_and(|ext| ext == "bak"))
                .count(),
            1
        );
        assert!(fs::read_dir(&fixture.0).unwrap().all(|entry| {
            !entry
                .unwrap()
                .path()
                .extension()
                .is_some_and(|extension| extension == "tmp")
        }));
    }

    #[test]
    fn successful_drawio_export_replaces_only_the_confirmed_destination() {
        let fixture = Fixture::new();
        let path = fixture.0.join("diagram.drawio");
        let backup = sibling(&path, ".bak");
        let previous = "<mxfile><diagram id=\"previous\"/></mxfile>";
        let contents = "<mxfile><diagram id=\"current\"/></mxfile>";
        fs::write(&path, previous).unwrap();
        fs::write(&backup, "unrelated backup").unwrap();
        let snapshot = read_snapshot(&path).unwrap();

        let warning = publish_with_validator(
            &path,
            contents,
            Some(&snapshot),
            || Ok(()),
            crate::drawio::validate_drawio_xml,
            false,
        )
        .unwrap();

        assert_eq!(warning, None);
        assert_eq!(fs::read_to_string(path).unwrap(), contents);
        assert_eq!(fs::read_to_string(backup).unwrap(), "unrelated backup");
    }

    #[test]
    fn drawio_export_keeps_an_external_destination_and_reports_the_recovery_backup() {
        let fixture = Fixture::new();
        let path = fixture.0.join("diagram.drawio");
        let previous = "<mxfile><diagram id=\"previous\"/></mxfile>";
        let external = "<mxfile><diagram id=\"external\"/></mxfile>";
        let contents = "<mxfile><diagram id=\"current\"/></mxfile>";
        fs::write(&path, previous).unwrap();
        let snapshot = read_snapshot(&path).unwrap();

        let error = publish_with_validator(
            &path,
            contents,
            Some(&snapshot),
            || fs::write(&path, external),
            crate::drawio::validate_drawio_xml,
            false,
        )
        .unwrap_err();

        assert!(error.contains("recovery backup"));
        assert_eq!(fs::read_to_string(&path).unwrap(), external);
        let backups = fs::read_dir(&fixture.0)
            .unwrap()
            .filter_map(|entry| entry.ok())
            .filter(|entry| {
                entry
                    .path()
                    .extension()
                    .is_some_and(|extension| extension == "bak")
            })
            .collect::<Vec<_>>();
        assert_eq!(backups.len(), 1);
        assert_eq!(fs::read_to_string(backups[0].path()).unwrap(), previous);
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
