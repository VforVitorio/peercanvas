use serde::Serialize;
use serde_json::{Map, Value};

/// A stable, locale-independent message returned to the renderer.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeMessage {
    pub code: String,
    pub params: Map<String, Value>,
}

impl NativeMessage {
    pub fn new(code: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            params: Map::new(),
        }
    }

    pub fn with_text(mut self, name: &str, value: impl Into<String>) -> Self {
        self.params.insert(name.into(), Value::String(value.into()));
        self
    }
}

/// Converts internal diagnostics to stable public identifiers. Unknown text is
/// intentionally discarded: native paths and OS error details must not cross
/// the renderer boundary.
pub fn from_text(text: &str) -> NativeMessage {
    use NativeMessage as M;
    match text {
        "Permission denied. Choose a writable location." => M::new("file.permissionDenied"),
        "Choose a regular file, not a symbolic link." => M::new("file.symbolicLinkRejected"),
        "Choose a regular file." => M::new("file.regularFileRequired"),
        "Choose a valid export location." => M::new("file.invalidExportLocation"),
        "Choose a valid export name." => M::new("file.invalidExportName"),
        "Choose a local export file." => M::new("file.localExportRequired"),
        "The temporary export backup already exists. Try another destination." => {
            M::new("file.temporaryBackupExists")
        }
        "Export failed; the previous file remains in a recovery backup in the same folder." => {
            M::new("file.exportBackupRetained")
        }
        "Saved, but the filesystem could not confirm directory durability." => {
            M::new("file.directoryNotDurable")
        }
        "Exported, but the previous file backup remains." => M::new("file.exportBackupRemains"),
        "Exported, but the filesystem could not confirm directory durability." => {
            M::new("file.directoryNotDurable")
        }
        "Saved, but the recent document preference could not be updated." => {
            M::new("preferences.writeFailed")
        }
        "The document is unavailable. Open it again or choose another file." => {
            M::new("document.unavailable")
        }
        "The document changed outside PeerCanvas. Open it again or use Save As." => {
            M::new("document.changedExternally")
        }
        "The document preference is invalid. Use Open instead." => M::new("preferences.reset"),
        "Choose a .peercanvas document." => M::new("document.invalidExtension"),
        "Choose a valid document location." => M::new("document.invalidLocation"),
        "Choose a valid document name." => M::new("document.invalidName"),
        "The document exceeds the 10 MiB limit." => M::new("document.sizeLimit"),
        "The document is not valid UTF-8." => M::new("document.invalidEncoding"),
        "The document is not valid JSON." => M::new("document.invalidJson"),
        "The recent document preference is invalid. Use Open instead." => {
            M::new("preferences.reset")
        }
        "Application preferences are unavailable." => M::new("preferences.unavailable"),
        "The document is still open." => M::new("document.stillOpen"),
        "The document exceeds the supported size limit." => M::new("document.sizeLimit"),
        "Choose a regular document file." => M::new("document.invalidFile"),
        "The open request expired. Open the document again." => M::new("document.openExpired"),
        "The primary document is unavailable." => M::new("document.primaryUnavailable"),
        "The backup document is unavailable." => M::new("document.backupUnavailable"),
        "Save the recovered document to a different file to preserve the original." => {
            M::new("document.recoveredSaveAs")
        }
        "That filename already exists. Choose a different filename for Save As." => {
            M::new("document.nameExists")
        }
        "Choose a local document file." => M::new("document.saveAsLocal"),
        "The selected draw.io file could not be opened." => M::new("drawio.openFailed"),
        "The selected draw.io file could not be inspected." => M::new("drawio.inspectFailed"),
        "The selected draw.io file could not be read." => M::new("drawio.readFailed"),
        "Choose a regular draw.io file." => M::new("drawio.regularFileRequired"),
        "The draw.io file exceeds the 10 MiB limit." => M::new("drawio.sizeLimit"),
        "Choose a local .drawio or .xml file." | "Choose a .drawio or .xml file." => {
            M::new("drawio.invalidExtension")
        }
        "The draw.io file is empty or exceeds the 10 MiB input limit." => {
            M::new("drawio.inputLimit")
        }
        "The draw.io document exceeds the 10 MiB decoded XML limit." => {
            M::new("drawio.decodedLimit")
        }
        "The draw.io page must contain between 1 and 100 pages." => M::new("drawio.pageCountLimit"),
        "The draw.io document exceeds the 100,000-element limit." => M::new("drawio.elementLimit"),
        "The draw.io XML exceeds parser resource limits." => M::new("drawio.parserLimit"),
        "The draw.io file is malformed or uses unsupported XML." => M::new("drawio.invalidXml"),
        "The draw.io file contains an undeclared entity." => M::new("drawio.undeclaredEntity"),
        "The draw.io file contains an active attribute or external reference." => {
            M::new("drawio.activeReference")
        }
        "Only UTF-8 draw.io files are supported." => M::new("drawio.invalidEncoding"),
        "The compressed draw.io page is empty or too large." => {
            M::new("drawio.compressedPageLimit")
        }
        "The compressed draw.io page is empty." => M::new("drawio.compressedPageEmpty"),
        "The compressed draw.io page cannot be decoded." => M::new("drawio.pageDecodeFailed"),
        "The compressed draw.io page exceeds decompression limits or has trailing data." => {
            M::new("drawio.decompressionLimit")
        }
        "The compressed draw.io page has invalid Base64." => M::new("drawio.invalidBase64"),
        "The compressed draw.io page has invalid URI encoding." => {
            M::new("drawio.invalidPageEncoding")
        }
        "The compressed draw.io page has invalid URI escapes." => {
            M::new("drawio.invalidPageEscapes")
        }
        "The draw.io compatibility data is invalid." => M::new("drawio.invalidCompatibility"),
        "The document JSON contains trailing data." => M::new("drawio.trailingJson"),
        "The document JSON is invalid or contains duplicate keys." => M::new("drawio.invalidJson"),
        "The draw.io compatibility page reference is invalid." => {
            M::new("drawio.invalidPageReference")
        }
        "The draw.io source cell map is invalid." => M::new("drawio.invalidSourceMap"),
        "The source default-layer mapping must target a layer." => {
            M::new("drawio.invalidLayerMapping")
        }
        "The draw.io compatibility data exceeds supported limits." => {
            M::new("drawio.compatibilityLimit")
        }
        "A safe source fragment exceeds the 64 KiB preservation limit." => {
            M::new("drawio.fragmentSizeLimit")
        }
        "The draw.io file exceeds the 1,000-fragment preservation limit." => {
            M::new("drawio.fragmentCountLimit")
        }
        "The draw.io file exceeds the 1 MiB source-preservation limit." => {
            M::new("drawio.sourceDataLimit")
        }
        "A draw.io cell identifier is invalid or too large." => M::new("drawio.invalidCellId"),
        "A preserved cell has no ID." => M::new("drawio.invalidFragmentId"),
        "Preserved draw.io fragments contain duplicate or invalid IDs." => {
            M::new("drawio.invalidFragmentId")
        }
        "The draw.io document exceeds the 10,000-style limit." => M::new("drawio.styleLimit"),
        "The draw.io document could not be mapped." => M::new("drawio.mappingFailed"),
        "The draw.io export is invalid or exceeds parser limits." => M::new("drawio.invalidExport"),
        "The draw.io export must contain between 1 and 100 pages." => {
            M::new("drawio.pageCountLimit")
        }
        "The PeerCanvas document does not match schema v2." => M::new("drawio.invalidDocument"),
        "The PeerCanvas document exceeds the 10 MiB input limit." => {
            M::new("drawio.documentSizeLimit")
        }
        "A draw.io page name exceeds the 256-character limit." => M::new("drawio.pageNameLimit"),
        "The imported PeerCanvas document exceeds the 10 MiB document limit." => {
            M::new("drawio.importedDocumentLimit")
        }
        "The PeerCanvas document is invalid or exceeds supported limits." => {
            M::new("drawio.invalidDocument")
        }
        "The PeerCanvas document contains duplicate identifiers." => {
            M::new("drawio.duplicateIdentifiers")
        }
        "The PeerCanvas document contains an invalid style." => M::new("drawio.invalidStyle"),
        "The PeerCanvas document contains an invalid page." => M::new("drawio.invalidPage"),
        "The PeerCanvas document contains an invalid layer." => M::new("drawio.invalidLayer"),
        "The PeerCanvas document contains an invalid node." => M::new("drawio.invalidNode"),
        "The PeerCanvas document contains an invalid connection." => {
            M::new("drawio.invalidConnection")
        }
        "The PeerCanvas document exceeds supported element limits." => {
            M::new("drawio.documentElementLimit")
        }
        "Only mxCell source fragments can be preserved." => M::new("drawio.invalidFragmentType"),
        "The source cell contains active label content." => M::new("drawio.activeSourceLabel"),
        "A preserved draw.io fragment exceeds its size limit." => {
            M::new("drawio.fragmentSizeLimit")
        }
        "The source cell contains an external or active style reference." => {
            M::new("drawio.externalStyle")
        }
        "The draw.io export exceeds the 10 MiB output limit." => M::new("drawio.exportSizeLimit"),
        "The draw.io source fragment exceeds the 64 KiB limit." => {
            M::new("drawio.fragmentSizeLimit")
        }
        "The draw.io file contains active or unsupported embedded content." => {
            M::new("drawio.activeContent")
        }
        "The draw.io file contains an external or active style reference." => {
            M::new("drawio.externalStyle")
        }
        "The draw.io file contains an active or external style feature." => {
            M::new("drawio.activeStyle")
        }
        "The draw.io file contains active label content." => M::new("drawio.activeLabel"),
        "The draw.io file contains unsupported embedded label content." => {
            M::new("drawio.embeddedLabel")
        }
        "Only UTF-8 draw.io XML is supported." => M::new("drawio.invalidEncoding"),
        "DTD and entity declarations are not supported." => M::new("drawio.dtdUnsupported"),
        "XML processing instructions are not supported." => {
            M::new("drawio.processingInstructionUnsupported")
        }
        "Namespaced draw.io XML is not supported." => M::new("drawio.namespaceUnsupported"),
        "The draw.io page has no root cell." => M::new("drawio.rootCellMissing"),
        "The draw.io page has no default layer cell." => M::new("drawio.defaultLayerMissing"),
        "The draw.io file root must be <mxfile> or <mxGraphModel>." => M::new("drawio.invalidRoot"),
        "A draw.io page does not contain an mxGraphModel root." => M::new("drawio.invalidPageRoot"),
        "The draw.io page contains duplicate cell IDs." => M::new("drawio.duplicateCellId"),
        "The draw.io file must contain between 1 and 100 pages." => M::new("drawio.pageCountLimit"),
        "The draw.io import metadata is invalid." => M::new("drawio.invalidMetadata"),
        "The draw.io source map contains conflicting export IDs." => {
            M::new("drawio.conflictingExportIds")
        }
        "The draw.io export preview is no longer available. Prepare it again." => {
            M::new("drawio.previewExpired")
        }
        "Review and confirm the reported losses before export." => M::new("drawio.confirmLosses"),
        "The draw.io export is unavailable. Restart PeerCanvas." => {
            M::new("drawio.exportUnavailable")
        }
        "The draw.io import could not finish." => M::new("drawio.importFailed"),
        "The draw.io export review could not finish." => M::new("drawio.exportReviewFailed"),
        "The file operation could not finish." => M::new("file.operationFailed"),
        "The file operation failed. Your last complete document or backup was retained." => {
            M::new("file.operationFailed")
        }
        "The application could not restore its last document preference." => {
            M::new("preferences.recovered")
        }
        _ if text.starts_with("mxGraphModel.") => {
            M::new("drawio.graphModelAttribute").with_text("name", &text[13..])
        }
        _ if text.starts_with("mxfile.") => {
            M::new("drawio.documentAttribute").with_text("name", &text[7..])
        }
        _ if text.starts_with("diagram.") => {
            M::new("drawio.pageAttribute").with_text("name", &text[8..])
        }
        _ if text.starts_with("Unsupported mxfile element <")
            && text.ends_with("> was not imported.") =>
        {
            let start = "Unsupported mxfile element <".len();
            let end = text.len() - "> was not imported.".len();
            M::new("drawio.unsupportedElement").with_text("name", &text[start..end])
        }
        _ => M::new("native.operationFailed"),
    }
}

/// Converts draw.io report entries to identifiers. XML-derived names are
/// parameters to a fixed translated phrase and are bounded before transport.
pub fn drawio_loss(text: &str) -> NativeMessage {
    use NativeMessage as M;
    let named = |code: &str, name: &str| {
        let safe_name = name
            .chars()
            .filter(|character| !character.is_control())
            .take(128)
            .collect::<String>();
        M::new(code).with_text("name", safe_name)
    };
    if let Some(name) = text.strip_prefix("mxGraphModel.") {
        return named("drawio.graphModelAttribute", name);
    }
    if let Some(name) = text.strip_prefix("mxfile.") {
        return named("drawio.documentAttribute", name);
    }
    if let Some(name) = text.strip_prefix("diagram.") {
        return named("drawio.pageAttribute", name);
    }
    if let Some(name) = text
        .strip_prefix("Unsupported mxfile element <")
        .and_then(|value| value.strip_suffix("> was not imported."))
    {
        return named("drawio.unsupportedElement", name);
    }
    match text {
        "Text directly inside mxGraphModel was not imported." => M::new("drawio.graphModelText"),
        "Unsupported XML outside the graph root was not imported." => {
            M::new("drawio.outsideGraphXml")
        }
        "Text directly inside the graph root was not imported." => M::new("drawio.graphRootText"),
        "Attributes on the graph root were not imported." => M::new("drawio.graphRootAttributes"),
        "Unsupported XML inside the graph root was not imported." => M::new("drawio.graphRootXml"),
        "Unsupported attributes or children on draw.io root cell were not imported." => {
            M::new("drawio.rootCellDetails")
        }
        "Unsupported attributes or children on the default draw.io layer were not imported." => {
            M::new("drawio.defaultLayerDetails")
        }
        "An invalid source page ID was replaced with a generated ID." => {
            M::new("drawio.pageIdReplaced")
        }
        "Text directly inside mxfile was not imported." => M::new("drawio.documentText"),
        "Unsupported XML inside a draw.io page was not imported." => M::new("drawio.pageXml"),
        "Document description is not represented in draw.io exports." => {
            M::new("drawio.documentDescription")
        }
        "Catalog shape references are represented as ordinary rectangles or text in draw.io exports." => {
            M::new("drawio.catalogShapeFallback")
        }
        "A preserved draw.io cell references a deleted or unavailable element and was omitted." => {
            M::new("drawio.preservedCellOmitted")
        }
        "Additional unsupported features are omitted from this report." => {
            M::new("drawio.lossesTruncated")
        }
        _ => M::new("drawio.unsupportedContent"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_current_drawio_loss_phrases_have_stable_message_ids() {
        let reports = [
            "mxGraphModel.grid",
            "Text directly inside mxGraphModel was not imported.",
            "Unsupported XML outside the graph root was not imported.",
            "Text directly inside the graph root was not imported.",
            "Attributes on the graph root were not imported.",
            "Unsupported XML inside the graph root was not imported.",
            "Unsupported attributes or children on draw.io root cell were not imported.",
            "Unsupported attributes or children on the default draw.io layer were not imported.",
            "An invalid source page ID was replaced with a generated ID.",
            "mxfile.name",
            "Text directly inside mxfile was not imported.",
            "Unsupported mxfile element <host> was not imported.",
            "diagram.background",
            "Unsupported XML inside a draw.io page was not imported.",
            "Catalog shape references are represented as ordinary rectangles or text in draw.io exports.",
            "A preserved draw.io cell references a deleted or unavailable element and was omitted.",
            "Additional unsupported features are omitted from this report.",
            "Document description is not represented in draw.io exports.",
        ];
        for report in reports {
            let message = drawio_loss(report);
            assert_ne!(message.code, "drawio.unsupportedContent", "{report}");
            assert!(!message.code.is_empty());
        }
    }

    #[test]
    fn unknown_native_errors_drop_raw_text_and_paths() {
        let message = from_text("Could not open /Users/private/diagram.peercanvas");
        assert_eq!(message.code, "native.operationFailed");
        assert!(message.params.is_empty());
    }
}
