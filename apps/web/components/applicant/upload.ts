/** Sends one document of an applicant file (multipart: token, typeId, file) with its progress; aborted on pause. */
export function sendApplicantDocument(
  token: string,
  typeId: string,
  file: File,
  signal: AbortSignal,
  onProgress: (sent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/applicant/documents");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () =>
      xhr.status < 300
        ? resolve()
        : reject(Object.assign(new Error(xhr.response?.code ?? "UNKNOWN"), { body: xhr.response }));
    xhr.onerror = () => reject(Object.assign(new Error("NETWORK"), { body: { code: "NETWORK" } }));
    signal.addEventListener("abort", () => xhr.abort());
    const body = new FormData();
    body.append("token", token);
    body.append("typeId", typeId);
    body.append("file", file);
    xhr.send(body);
  });
}
