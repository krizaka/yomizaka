//! The Mac's `DocumentStore` (ADR-0007): the documents Yomizaka keeps for the person on this Mac — « keep my history » when
//! the workspace allows it — in a folder of the app's own (`~/Library/Application Support/<bundle id>/documents`), never
//! anywhere else. The page reaches it through `apps/desktop/src/lib/mac-store.ts`, which passes the same contract test as
//! every other adapter. A key is the port's (lowercase letters, digits, `/_.-`), checked again here: no `..`, no empty
//! segment, no absolute path, and a symlink planted inside the folder is never followed out of it.

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

/// The longest key the port accepts (`assertKey` of `@yomizaka/core`).
// @fixed: the port's key rule, not a setting
const MAX_KEY: usize = 255;
const META_DIR: &str = ".meta";

#[derive(Debug, PartialEq, Eq)]
pub enum StoreError {
    /// Not a key of the port, or a path that would leave the store: the page's `StorageError(400)`.
    BadKey,
    Io(String),
}

impl std::fmt::Display for StoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StoreError::BadKey => write!(f, "400: not a valid object key"),
            StoreError::Io(e) => write!(f, "500: {e}"),
        }
    }
}

fn io(e: std::io::Error) -> StoreError {
    StoreError::Io(e.to_string())
}

/// The port's key rule: `^[a-z0-9][a-z0-9/_.-]{0,254}$`, without `..`, `//` or a trailing `/`.
pub fn check_key(key: &str) -> Result<(), StoreError> {
    let first_ok = key.chars().next().is_some_and(|c| c.is_ascii_lowercase() || c.is_ascii_digit());
    let chars_ok = key
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '/' | '_' | '.' | '-'));
    if !first_ok || !chars_ok || key.len() > MAX_KEY || key.contains("..") || key.contains("//") || key.ends_with('/') {
        return Err(StoreError::BadKey);
    }
    Ok(())
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Meta {
    content_type: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredDocument {
    /// base64: the bytes cross to the page once.
    pub data: String,
    pub content_type: String,
}

pub struct FolderStore {
    root: PathBuf,
}

impl FolderStore {
    pub fn new(root: PathBuf) -> Self {
        FolderStore { root }
    }

    fn canonical_root(&self) -> Result<PathBuf, StoreError> {
        fs::create_dir_all(&self.root).map_err(io)?;
        self.root.canonicalize().map_err(io)
    }

    /// The file of a key, inside the store: its folders created, and every existing part of the path checked to stay under
    /// the root once links are resolved (a link planted in the folder is a way out, refused).
    fn path_of(&self, base: &Path, key: &str, create: bool) -> Result<PathBuf, StoreError> {
        check_key(key)?;
        let root = self.canonical_root()?;
        let file = root.join(base).join(key);
        let parent = file.parent().ok_or(StoreError::BadKey)?;
        if create {
            fs::create_dir_all(parent).map_err(io)?;
        }
        if parent.exists() && !parent.canonicalize().map_err(io)?.starts_with(&root) {
            return Err(StoreError::BadKey);
        }
        if let Ok(meta) = fs::symlink_metadata(&file) {
            if meta.file_type().is_symlink() || meta.is_dir() {
                return Err(StoreError::BadKey);
            }
        }
        Ok(file)
    }

    fn write_atomically(file: &Path, bytes: &[u8]) -> Result<(), StoreError> {
        let name = file.file_name().ok_or(StoreError::BadKey)?.to_string_lossy().to_string();
        let temporary = file.with_file_name(format!(".{name}.tmp"));
        {
            let mut out = fs::File::create(&temporary).map_err(io)?;
            out.write_all(bytes).map_err(io)?;
            out.sync_all().map_err(io)?;
        }
        fs::rename(&temporary, file).map_err(|e| {
            let _ = fs::remove_file(&temporary);
            io(e)
        })
    }

    pub fn put(&self, key: &str, bytes: &[u8], content_type: &str) -> Result<(), StoreError> {
        let file = self.path_of(Path::new(""), key, true)?;
        let meta = self.path_of(Path::new(META_DIR), key, true)?;
        Self::write_atomically(&file, bytes)?;
        let json = serde_json::to_vec(&Meta {
            content_type: content_type.to_string(),
        })
        .map_err(|e| StoreError::Io(e.to_string()))?;
        Self::write_atomically(&meta, &json)
    }

    pub fn get(&self, key: &str) -> Result<Option<StoredDocument>, StoreError> {
        let file = self.path_of(Path::new(""), key, false)?;
        if !file.is_file() {
            return Ok(None);
        }
        let bytes = fs::read(&file).map_err(io)?;
        let meta = self.path_of(Path::new(META_DIR), key, false)?;
        let content_type = fs::read(&meta)
            .ok()
            .and_then(|raw| serde_json::from_slice::<Meta>(&raw).ok())
            .map(|m| m.content_type)
            .unwrap_or_else(|| "application/octet-stream".into());
        Ok(Some(StoredDocument {
            data: STANDARD.encode(bytes),
            content_type,
        }))
    }

    /// Idempotent: deleting what is not there succeeds.
    pub fn delete(&self, key: &str) -> Result<(), StoreError> {
        for base in ["", META_DIR] {
            let file = self.path_of(Path::new(base), key, false)?;
            match fs::remove_file(&file) {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => return Err(io(e)),
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn store() -> (tempfile::TempDir, FolderStore) {
        let d = tempdir().unwrap();
        let s = FolderStore::new(d.path().join("documents"));
        (d, s)
    }

    #[test]
    fn keeps_a_document_byte_for_byte_with_its_type_and_forgets_it_twice() {
        let (_d, s) = store();
        let bytes = [37u8, 80, 68, 70, 0, 255, 1, 2, 3];
        s.put("library/2026/bail.pdf", &bytes, "application/pdf").unwrap();
        let got = s.get("library/2026/bail.pdf").unwrap().unwrap();
        assert_eq!(STANDARD.decode(got.data).unwrap(), bytes);
        assert_eq!(got.content_type, "application/pdf");
        s.delete("library/2026/bail.pdf").unwrap();
        s.delete("library/2026/bail.pdf").unwrap();
        assert_eq!(s.get("library/2026/bail.pdf").unwrap(), None);
    }

    #[test]
    fn refuses_a_key_that_could_leave_the_store() {
        let (_d, s) = store();
        for bad in ["../x", "a/../b", "/abs", "a//b", "UPPER/case", "a/b/", "", ".hidden/x", "a\\b"] {
            assert_eq!(s.put(bad, b"x", "text/plain"), Err(StoreError::BadKey), "{bad:?}");
            assert_eq!(s.get(bad).err(), Some(StoreError::BadKey), "{bad:?}");
        }
        assert!(s.put(&"a".repeat(MAX_KEY + 1), b"x", "text/plain").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn never_follows_a_link_planted_in_the_store() {
        let (d, s) = store();
        let outside = d.path().join("outside");
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secret.pdf"), "%PDF secret").unwrap();
        fs::create_dir_all(d.path().join("documents")).unwrap();
        // A folder link out of the store, and a file link to a file outside it.
        std::os::unix::fs::symlink(&outside, d.path().join("documents/escape")).unwrap();
        std::os::unix::fs::symlink(outside.join("secret.pdf"), d.path().join("documents/innocent.pdf")).unwrap();
        assert_eq!(s.get("escape/secret.pdf").err(), Some(StoreError::BadKey));
        assert_eq!(s.put("escape/new.pdf", b"x", "text/plain"), Err(StoreError::BadKey));
        assert_eq!(s.get("innocent.pdf").err(), Some(StoreError::BadKey));
        assert_eq!(s.put("innocent.pdf", b"x", "text/plain"), Err(StoreError::BadKey));
        assert_eq!(fs::read_to_string(outside.join("secret.pdf")).unwrap(), "%PDF secret");
        assert!(!outside.join("new.pdf").exists());
    }

    #[test]
    fn errors_read_as_the_page_s_status() {
        assert!(StoreError::BadKey.to_string().starts_with("400"));
        assert!(StoreError::Io("disk".into()).to_string().starts_with("500"));
    }
}
