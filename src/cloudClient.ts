export type CloudAccount = {
  user: { name: string; email?: string };
  csrfToken: string;
};
export type CloudWorkbookMeta = {
  name: string;
  size: number;
  sha256: string;
  savedAt: string;
};
export class CloudError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function errorFor(response: Response) {
  let message =
    "L’espace cloud ne répond pas. Réessayez sans remplacer votre import précédent.";
  try {
    const body = await response.json();
    if (typeof body.error === "string") message = body.error;
  } catch {
    /* Une réponse de proxy peut ne pas être JSON. */
  }
  return new CloudError(message, response.status);
}
export async function getCloudAccount(): Promise<CloudAccount | null> {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw await errorFor(response);
  const body = await response.json();
  if (!body.user) return null;
  if (typeof body.user.name !== "string" || typeof body.csrfToken !== "string")
    throw new CloudError("Connexion Manus non validée.", 401);
  return body;
}
export async function readCloudWorkbook(): Promise<
  (CloudWorkbookMeta & { buffer: ArrayBuffer }) | null
> {
  const response = await fetch("/api/workbook", {
    credentials: "include",
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw await errorFor(response);
  const buffer = await response.arrayBuffer();
  const name = decodeURIComponent(
    response.headers.get("X-Workbook-Name") || "MYMARKET-import.xlsx",
  );
  const savedAt = response.headers.get("X-Workbook-Saved-At") || "";
  const sha256 = response.headers.get("X-Workbook-Sha256") || "";
  if (!savedAt || !/^[a-f0-9]{64}$/.test(sha256))
    throw new CloudError("Métadonnées du classeur cloud invalides.", 502);
  return { name, savedAt, sha256, size: buffer.byteLength, buffer };
}
export async function saveCloudWorkbook(
  buffer: ArrayBuffer,
  name: string,
  account: CloudAccount,
  previous: CloudWorkbookMeta | null,
): Promise<CloudWorkbookMeta> {
  const response = await fetch("/api/workbook", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Mymarket-CSRF": account.csrfToken,
      "X-Workbook-Name": encodeURIComponent(name),
      "X-Workbook-Revision": previous?.sha256 || "none",
    },
    body: buffer,
  });
  if (!response.ok) throw await errorFor(response);
  return (await response.json()).workbook;
}
export async function logoutCloud(account: CloudAccount) {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    headers: { "X-Mymarket-CSRF": account.csrfToken },
  });
  if (!response.ok) throw await errorFor(response);
}
export async function downloadCloudWorkbook() {
  const record = await readCloudWorkbook();
  if (!record) throw new CloudError("Aucun classeur cloud enregistré.", 404);
  const url = URL.createObjectURL(
    new Blob([record.buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = record.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
