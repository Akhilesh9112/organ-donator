const configured = (process.env.REACT_APP_API_URL || "/api")
  .replace(/\/$/, "")
  .replace(/\/users$/, "");
export const API_BASE_URL = configured;
export async function authFetch(
  path,
  { method = "GET", body, token, headers = {}, ...rest } = {},
) {
  const form = body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(!form && body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    ...rest,
  });
  const data =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token)
      window.dispatchEvent(new Event("organsync:session-expired"));
    const error = new Error(
      data?.message || `Request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
export async function openMedicalFile(id, token) {
  const response = await fetch(`${API_BASE_URL}/medical-records/file/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Unable to open this document");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `medical-document-${id}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
