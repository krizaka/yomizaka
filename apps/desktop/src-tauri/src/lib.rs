//! Yomizaka for the Mac. The window is a local page; everything that touches the disk goes through here, behind the
//! folder scope of krizaka-tauri-kit: the page can read a folder the person granted, or a file they dropped on the window,
//! and nothing else. The session token lives in the Keychain.

mod documents;
mod vault;

use krizaka_tauri_kit::access::Access;
use krizaka_tauri_kit::files::{self, Listing};
use krizaka_tauri_kit::scope::ScopeStore;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{DragDropEvent, Emitter, Manager, State, WindowEvent};
use tauri_plugin_dialog::DialogExt;

/// The largest file read for a check; the server's own limit (read from its settings) is applied by the page first.
// @fixed: a hard stop in the native layer, whatever the page says
const MAX_DOCUMENT_BYTES: u64 = files::MAX_SEND;
const SCOPE_FILE: &str = "scope.json";
const DROPPED_EVENT: &str = "documents-dropped";

type Shared<'a> = State<'a, Mutex<Access>>;

fn scope_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join(SCOPE_FILE))
}

fn paths_of(roots: &[PathBuf]) -> Vec<String> {
    roots.iter().map(|r| r.display().to_string()).collect()
}

#[tauri::command]
fn folders(access: Shared) -> Vec<String> {
    paths_of(access.lock().unwrap().scope().roots())
}

/// The native folder picker; the chosen folder is granted if it may be (never the home, the system, `~/.ssh`…).
#[tauri::command]
async fn grant_folder(app: tauri::AppHandle, access: Shared<'_>) -> Result<Option<String>, String> {
    let Some(picked) = app.dialog().file().blocking_pick_folder() else { return Ok(None) };
    let folder = picked.into_path().map_err(|e| e.to_string())?;
    let mut guard = access.lock().unwrap();
    let granted = guard.scope_mut().grant(&folder).map_err(|e| e.to_string())?;
    guard.scope().save(&scope_file(&app)?).map_err(|e| e.to_string())?;
    Ok(Some(granted.display().to_string()))
}

#[tauri::command]
fn revoke_folder(app: tauri::AppHandle, access: Shared, path: String) -> Result<Vec<String>, String> {
    let mut guard = access.lock().unwrap();
    guard.scope_mut().revoke(Path::new(&path));
    guard.scope().save(&scope_file(&app)?).map_err(|e| e.to_string())?;
    Ok(paths_of(guard.scope().roots()))
}

/// The documents of a granted folder: PDFs and text files, folders first.
#[tauri::command]
fn list_folder(access: Shared, path: String) -> Result<Listing, String> {
    let dir = access.lock().unwrap().resolve(Path::new(&path)).map_err(|e| e.to_string())?;
    let mut listing = files::list_dir(&dir)?;
    listing.entries.retain(|e| e.is_dir || documents::is_checkable(&e.name));
    Ok(listing)
}

/// One document's bytes, for the one check that needs them.
#[tauri::command]
fn read_document(access: Shared, path: String) -> Result<documents::DocumentBytes, String> {
    let file = access.lock().unwrap().resolve(Path::new(&path)).map_err(|e| e.to_string())?;
    documents::read_checkable(&file, MAX_DOCUMENT_BYTES)
}

/// Writes the signed report next to its document; the folder is the document's, resolved through the same gate.
#[tauri::command]
fn save_report(access: Shared, document: String, name: String, data: String) -> Result<String, String> {
    let file = access.lock().unwrap().resolve(Path::new(&document)).map_err(|e| e.to_string())?;
    documents::save_report(&file, &name, &data).map(|p| p.display().to_string())
}

#[tauri::command]
fn session_token() -> Result<Option<String>, String> {
    vault::read()
}

#[tauri::command]
fn store_session_token(token: String) -> Result<(), String> {
    vault::write(&token)
}

#[tauri::command]
fn clear_session_token() -> Result<(), String> {
    vault::clear()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let scope = ScopeStore::load(&scope_file(app.handle())?);
            app.manage(Mutex::new(Access::new(scope)));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event {
                let access = window.state::<Mutex<Access>>();
                let allowed: Vec<String> = {
                    let mut guard = access.lock().unwrap();
                    paths.iter().filter_map(|p| guard.allow_dropped(p)).map(|p| p.display().to_string()).collect()
                };
                let _ = window.emit(DROPPED_EVENT, allowed);
            }
        })
        .invoke_handler(tauri::generate_handler![
            folders,
            grant_folder,
            revoke_folder,
            list_folder,
            read_document,
            save_report,
            session_token,
            store_session_token,
            clear_session_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running Yomizaka");
}
