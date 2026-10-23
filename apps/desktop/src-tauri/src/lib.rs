//! Yomizaka for the Mac. What every Krizaka Mac app does the same way — the folders the person grants (and watches), the
//! files dropped on the window, the session in the Keychain, the native menu, `yomizaka://` links, the navigation guard —
//! is `tauri-plugin-krizaka` (krizaka-tauri-kit). Here are only Yomizaka's own commands: list a folder's documents, read
//! one for the check that needs it, write the signed report next to it — each path through the kit's one gate.

mod documents;

use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_krizaka::kit::files::{self, Listing};
use tauri_plugin_krizaka::KitExt;

/// The largest file read for a check; the server's own limit (read from its settings) is applied by the page first.
// @fixed: a hard stop in the native layer, whatever the page says
const MAX_DOCUMENT_BYTES: u64 = files::MAX_SEND;

/// The documents of a granted folder: what a check reads, and the folders, folders first.
#[tauri::command]
fn list_documents(app: AppHandle, path: String) -> Result<Listing, String> {
    let dir = app.kit().resolve(Path::new(&path))?;
    let mut listing = files::list_dir(&dir)?;
    listing.entries.retain(|e| e.is_dir || documents::is_checkable(&e.name));
    Ok(listing)
}

/// One document's bytes, for the one check that needs them.
#[tauri::command]
fn read_document(app: AppHandle, path: String) -> Result<documents::DocumentBytes, String> {
    let file = app.kit().resolve(Path::new(&path))?;
    documents::read_checkable(&file, MAX_DOCUMENT_BYTES)
}

/// Writes the signed report next to its document; the folder is the document's, resolved through the same gate.
#[tauri::command]
fn save_report(app: AppHandle, document: String, name: String, data: String) -> Result<String, String> {
    let file = app.kit().resolve(Path::new(&document))?;
    documents::save_report(&file, &name, &data).map(|p| p.display().to_string())
}

pub fn run() {
    tauri::Builder::default()
        // The API calls go through Rust's HTTP client (no CORS), to Yomizaka's own addresses (the capability).
        .plugin(tauri_plugin_http::init())
        // The folder picker the kit's commands open (re-exported by the kit).
        .plugin(tauri_plugin_krizaka::dialog::init())
        .plugin(
            tauri_plugin_krizaka::Builder::new("yomizaka")
                .link_hosts(["www.yomizaka.com", "dev.yomizaka.com"])
                .link_prefixes(["/app"])
                .build(),
        )
        .invoke_handler(tauri::generate_handler![list_documents, read_document, save_report])
        .run(tauri::generate_context!())
        .expect("error while running Yomizaka");
}
