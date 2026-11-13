use crate::messages::{self, NativeMessage};
use crate::{drawio, persistence};
use serde::Serialize;
use std::{
    fs::File,
    io::Read,
    path::Path,
    sync::{Arc, Mutex},
};
use tauri::State;
use tauri_plugin_dialog::DialogExt;

type Result<T> = std::result::Result<T, String>;

#[derive(Default, Clone)]
pub struct InterchangeState(Arc<Mutex<Option<PendingExport>>>);

struct PendingExport {
    token: String,
    candidate: drawio::DrawioExportCandidate,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawioImportResult {
    pub display_name: String,
    pub document: serde_json::Value,
    pub losses: Vec<NativeMessage>,
    pub preserved_fragment_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawioExportReview {
    pub token: String,
    pub losses: Vec<NativeMessage>,
    pub preserved_fragment_count: usize,
}

fn title_from_path(path: &std::path::Path) -> String {
    let title: String = path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .chars()
        .take(256)
        .collect();
    if title.is_empty() {
        "Imported diagram".into()
    } else {
        title
    }
}

fn read_bounded_file(path: &Path) -> Result<Vec<u8>> {
    let file = File::open(path)
        .map_err(|_| "The selected draw.io file could not be opened.".to_string())?;
    let metadata = file
        .metadata()
        .map_err(|_| "The selected draw.io file could not be inspected.".to_string())?;
    if !metadata.is_file() {
        return Err("Choose a regular draw.io file.".into());
    }
    if metadata.len() > drawio::MAX_DRAWIO_BYTES as u64 {
        return Err("The draw.io file exceeds the 10 MiB limit.".into());
    }
    let mut bytes = Vec::new();
    file.take(drawio::MAX_DRAWIO_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "The selected draw.io file could not be read.".to_string())?;
    if bytes.len() > drawio::MAX_DRAWIO_BYTES {
        return Err("The draw.io file exceeds the 10 MiB limit.".into());
    }
    Ok(bytes)
}

#[tauri::command]
pub async fn import_drawio(
    app: tauri::AppHandle,
    now: String,
) -> persistence::NativeResult<Option<DrawioImportResult>> {
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .add_filter("draw.io", &["drawio", "xml"])
            .blocking_pick_file()
            .map(|path| {
                path.into_path()
                    .map_err(|_| "Choose a local .drawio or .xml file.".to_string())
            })
            .transpose()?;
        let Some(path) = selected else {
            return Ok(None);
        };
        let display_name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
        if !path.extension().is_some_and(|extension| {
            extension.eq_ignore_ascii_case("drawio") || extension.eq_ignore_ascii_case("xml")
        }) {
            return Err("Choose a .drawio or .xml file.".into());
        }
        let bytes = read_bounded_file(&path)?;
        let candidate = drawio::parse_drawio_document(&bytes, &title_from_path(&path), &now)?;
        Ok(Some(DrawioImportResult {
            display_name,
            document: candidate.document,
            losses: candidate
                .losses
                .iter()
                .map(|loss| messages::drawio_loss(loss))
                .collect(),
            preserved_fragment_count: candidate.preserved_fragment_count,
        }))
    })
    .await
    .map_err(|_| "The draw.io import could not finish.".to_string())
    .map_err(persistence::native_error)?
    .map_err(persistence::native_error)
}

#[tauri::command]
pub async fn prepare_drawio_export(
    state: State<'_, InterchangeState>,
    contents: String,
) -> persistence::NativeResult<DrawioExportReview> {
    let state = state.inner().clone();
    let candidate =
        tauri::async_runtime::spawn_blocking(move || drawio::prepare_drawio_export(&contents))
            .await
            .map_err(|_| "The draw.io export review could not finish.".to_string())
            .map_err(persistence::native_error)?
            .map_err(persistence::native_error)?;
    let token = uuid::Uuid::new_v4().to_string();
    let review = DrawioExportReview {
        token: token.clone(),
        losses: candidate
            .losses
            .iter()
            .map(|loss| messages::drawio_loss(loss))
            .collect(),
        preserved_fragment_count: candidate.preserved_fragment_count,
    };
    let mut pending = state
        .0
        .lock()
        .map_err(|_| "The draw.io export is unavailable. Restart PeerCanvas.".to_string())
        .map_err(persistence::native_error)?;
    *pending = Some(PendingExport { token, candidate });
    Ok(review)
}

#[tauri::command]
pub async fn export_drawio(
    app: tauri::AppHandle,
    state: State<'_, InterchangeState>,
    token: String,
    confirm_losses: bool,
    locale: persistence::LocalePreference,
) -> persistence::NativeResult<Option<persistence::DrawioSaveOutcome>> {
    let state = state.inner().clone();
    let candidate = {
        let mut pending = state
            .0
            .lock()
            .map_err(|_| "The draw.io export is unavailable. Restart PeerCanvas.".to_string())
            .map_err(persistence::native_error)?;
        let current = pending
            .as_ref()
            .filter(|candidate| candidate.token == token)
            .ok_or_else(|| {
                "The draw.io export preview is no longer available. Prepare it again.".to_owned()
            })
            .map_err(persistence::native_error)?;
        if !current.candidate.losses.is_empty() && !confirm_losses {
            return Err(messages::from_text(
                "Review and confirm the reported losses before export.",
            ));
        }
        pending
            .take()
            .map(|candidate| candidate.candidate)
            .ok_or_else(|| {
                "The draw.io export preview is no longer available. Prepare it again.".to_owned()
            })
            .map_err(persistence::native_error)?
    };
    persistence::export_drawio_file(app, candidate.xml, locale)
        .await
        .map_err(persistence::native_error)
}

#[tauri::command]
pub async fn discard_drawio_export(
    state: State<'_, InterchangeState>,
    token: String,
) -> persistence::NativeResult<()> {
    let state = state.inner().clone();
    let mut pending = state
        .0
        .lock()
        .map_err(|_| "The draw.io export is unavailable. Restart PeerCanvas.".to_string())
        .map_err(persistence::native_error)?;
    if pending
        .as_ref()
        .is_some_and(|candidate| candidate.token == token)
    {
        *pending = None;
    }
    Ok(())
}
