import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { CurriculumDocumentTemplateType } from "@/lib/curriculum-document-templates";
import { createClient } from "@/lib/local/client";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DOCS_API = "https://docs.googleapis.com/v1";
export const GOOGLE_DOC_MIME_TYPE = "application/vnd.google-apps.document";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/documents",
];

export const GOOGLE_PROVIDER = "google_drive";
export type CurriculumDocumentSelectionMethod =
  | "created"
  | "pasted_url"
  | "google_picker";

// ─── Connection State Persistence ("Memory") ─────────────────────────────────
// A lightweight state file that remembers the connection independent of the
// encrypted token in db.json. Survives dev-server restarts, HMR, and
// transient db.json write failures.
const STATE_DIR = path.join(process.cwd(), ".synapse-data");
const STATE_FILE = path.join(STATE_DIR, "google-drive-state.json");

type ConnectionState = {
  connected: boolean;
  userId: string;
  connectedAt: string;
  email?: string;
};

async function readConnectionState(): Promise<ConnectionState | null> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    return JSON.parse(raw) as ConnectionState;
  } catch {
    return null;
  }
}

async function writeConnectionState(
  state: ConnectionState | null,
): Promise<void> {
  try {
    await fs.mkdir(STATE_DIR, { recursive: true });
    if (state === null) {
      await fs.rm(STATE_FILE, { force: true });
    } else {
      await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
    }
  } catch (err) {
    console.warn("[google-drive] Failed to write connection state:", err);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenKey: string;
};

export class GoogleDriveError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "GoogleDriveError";
  }
}

export type CurriculumOwnerType = "subject" | "ia" | "ee" | "tok" | "cas";

export type CurriculumDocument = {
  id: string;
  user_id: string;
  owner_type: CurriculumOwnerType;
  owner_id: string;
  subject_id?: string | null;
  title: string;
  document_id: string;
  document_url: string;
  folder_id?: string | null;
  source: "google_drive";
  template_type?: CurriculumDocumentTemplateType | null;
  selection_method?: CurriculumDocumentSelectionMethod | null;
  mime_type?: string | null;
  last_opened_at?: string | null;
  last_synced_at?: string | null;
  created_at: string;
  updated_at?: string;
};

type GoogleIntegrationRow = {
  id: string;
  user_id: string;
  provider: typeof GOOGLE_PROVIDER;
  encrypted_refresh_token: string;
  scopes?: string[];
  metadata?: {
    root_folder_id?: string;
    root_folder_url?: string;
  };
  created_at: string;
  updated_at?: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type DriveFile = {
  id: string;
  name?: string;
  webViewLink?: string;
  mimeType?: string;
};

type GoogleDocumentSnapshot = {
  title?: string;
  body?: {
    content?: GoogleStructuralElement[];
  };
};

type GoogleStructuralElement = {
  paragraph?: {
    elements?: Array<{
      textRun?: {
        content?: string;
      };
    }>;
  };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: GoogleStructuralElement[];
      }>;
    }>;
  };
  tableOfContents?: {
    content?: GoogleStructuralElement[];
  };
};

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value && !value.startsWith("paste-") ? value : undefined;
}

export function getGoogleConfig(): GoogleConfig | null {
  const clientId = readEnv("GOOGLE_CLIENT_ID");
  const clientSecret = readEnv("GOOGLE_CLIENT_SECRET");
  const tokenKey = readEnv("GOOGLE_TOKEN_ENCRYPTION_KEY");
  const redirectUri =
    readEnv("GOOGLE_REDIRECT_URI") ??
    `${getBaseUrl().replace(/\/$/, "")}/api/integrations/google/callback`;

  if (!clientId || !clientSecret || !tokenKey) return null;
  return { clientId, clientSecret, redirectUri, tokenKey };
}

export function isGoogleDriveConfigured() {
  return Boolean(getGoogleConfig());
}

function encryptionKey(secret: string) {
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptToken(token: string, secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function decryptToken(payload: string, secret: string) {
  const [iv, tag, encrypted] = payload
    .split(".")
    .map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted) throw new Error("Invalid stored Google token");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

function signState(unsigned: string, secret: string) {
  return crypto
    .createHmac("sha256", secret)
    .update(unsigned)
    .digest("base64url");
}

function encodeState(userId: string, returnTo: string, secret: string) {
  const state = {
    userId,
    returnTo: returnTo.startsWith("/") ? returnTo : "/settings",
    nonce: crypto.randomUUID(),
    issuedAt: Date.now(),
  };
  const unsigned = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${unsigned}.${signState(unsigned, secret)}`;
}

export function decodeGoogleState(state: string, secret: string) {
  const [unsigned, signature] = state.split(".");
  if (!unsigned || !signature || signState(unsigned, secret) !== signature) {
    throw new Error("Invalid Google authorization state");
  }
  const decoded = JSON.parse(
    Buffer.from(unsigned, "base64url").toString("utf8"),
  ) as {
    userId: string;
    returnTo?: string;
    issuedAt: number;
  };
  if (Date.now() - decoded.issuedAt > 10 * 60 * 1000) {
    throw new Error("Google authorization state expired");
  }
  return {
    userId: decoded.userId,
    returnTo: decoded.returnTo?.startsWith("/")
      ? decoded.returnTo
      : "/settings",
  };
}

export function buildGoogleAuthUrl(userId: string, returnTo = "/settings") {
  const config = getGoogleConfig();
  if (!config) throw new Error("Google Drive is not configured");

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", encodeState(userId, returnTo, config.tokenKey));
  return url.toString();
}

async function requestToken(body: Record<string, string>) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = (await response.json()) as TokenResponse;
  if (!response.ok || data.error) {
    throw new GoogleDriveError(
      data.error ?? "token_request_failed",
      data.error_description ?? data.error ?? "Google token request failed",
    );
  }
  return data;
}

export async function exchangeGoogleCode(code: string) {
  const config = getGoogleConfig();
  if (!config) throw new Error("Google Drive is not configured");
  return requestToken({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });
}

export async function saveGoogleIntegration(
  userId: string,
  tokens: TokenResponse,
) {
  const config = getGoogleConfig();
  if (!config) throw new Error("Google Drive is not configured");
  const existing = await getGoogleIntegration(userId);
  let refreshToken = tokens.refresh_token;

  if (!refreshToken && existing) {
    refreshToken = decryptToken(
      existing.encrypted_refresh_token,
      config.tokenKey,
    );
  }

  if (!refreshToken) {
    throw new GoogleDriveError(
      "missing_refresh_token",
      "Google did not return a refresh token. Revoke Synapse access in your Google Account, then connect again.",
    );
  }

  const local = await createClient();
  const nowStr = new Date().toISOString();
  await local.from("integrations").upsert(
    {
      user_id: userId,
      provider: GOOGLE_PROVIDER,
      encrypted_refresh_token: encryptToken(refreshToken, config.tokenKey),
      scopes: tokens.scope?.split(" ") ?? GOOGLE_SCOPES,
      metadata: {},
      updated_at: nowStr,
    },
    { onConflict: "user_id,provider" },
  );

  // Persist lightweight connection state (survives dev-server restarts)
  await writeConnectionState({
    connected: true,
    userId,
    connectedAt: nowStr,
  });

  // Verify the write succeeded by reading back
  const verification = await getGoogleIntegration(userId);
  if (!verification) {
    console.error(
      "[google-drive] WARNING: Integration write did not persist to db.json",
    );
  }
}

export async function getGoogleIntegration(userId: string) {
  const local = await createClient();
  const { data } = await local
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", GOOGLE_PROVIDER)
    .maybeSingle();
  return data as GoogleIntegrationRow | null;
}

export async function getGoogleDriveStatus(userId: string) {
  const configured = isGoogleDriveConfigured();
  if (!configured) {
    return { configured: false, connected: false, needsRefresh: false };
  }

  // Primary check: integration row in db.json
  let connected = false;
  let needsRefresh = false;
  try {
    const integration = await getGoogleIntegration(userId);
    if (integration) {
      // Verify we can still decrypt the token (catches key changes)
      const config = getGoogleConfig();
      if (config) {
        try {
          decryptToken(integration.encrypted_refresh_token, config.tokenKey);
          connected = true;
        } catch {
          // Token exists but can't be decrypted — key likely changed
          needsRefresh = true;
          console.warn(
            "[google-drive] Stored token cannot be decrypted. Encryption key may have changed.",
          );
        }
      }
    }
  } catch (err) {
    console.warn("[google-drive] Error reading integration from db:", err);
  }

  // Fallback: check the lightweight state file if db didn't find it
  if (!connected && !needsRefresh) {
    const state = await readConnectionState();
    if (state?.connected && state.userId === userId) {
      // State file remembers a connection but db.json doesn't have it
      // This means the db write failed previously — flag for reconnection
      needsRefresh = true;
    }
  }

  return { configured, connected, needsRefresh };
}

export async function disconnectGoogleDrive(userId: string) {
  const local = await createClient();
  await local
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", GOOGLE_PROVIDER);

  // Clear the connection state memory
  await writeConnectionState(null);
}

async function getGoogleAccessToken(userId: string) {
  const config = getGoogleConfig();
  if (!config)
    throw new GoogleDriveError(
      "google_not_configured",
      "Google Drive is not configured",
    );
  const integration = await getGoogleIntegration(userId);
  if (!integration)
    throw new GoogleDriveError(
      "google_not_connected",
      "Connect Google Drive before using Google documents",
    );
  const refreshToken = decryptToken(
    integration.encrypted_refresh_token,
    config.tokenKey,
  );
  const token = await requestToken({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });
  if (!token.access_token)
    throw new GoogleDriveError(
      "missing_access_token",
      "Google did not return an access token",
    );
  return { accessToken: token.access_token, integration };
}

async function googleFetch<T>(
  accessToken: string,
  url: string,
  init: RequestInit = {},
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const text = await response.text();
  const data = (text ? JSON.parse(text) : {}) as T & {
    error?: { code?: number; message?: string; status?: string };
  };
  if (!response.ok) {
    throw new GoogleDriveError(
      data.error?.status?.toLowerCase() ?? `google_${response.status}`,
      data.error?.message ?? "Google Drive request failed",
    );
  }
  return data as T;
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFolder(
  accessToken: string,
  name: string,
  parentId?: string,
) {
  const clauses = [
    `name = '${escapeDriveQuery(name)}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
  ];
  if (parentId) clauses.push(`'${escapeDriveQuery(parentId)}' in parents`);
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("q", clauses.join(" and "));
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("fields", "files(id,name,webViewLink)");
  const data = await googleFetch<{ files?: DriveFile[] }>(
    accessToken,
    url.toString(),
  );
  return data.files?.[0] ?? null;
}

async function createFolder(
  accessToken: string,
  name: string,
  parentId?: string,
) {
  return googleFetch<DriveFile>(
    accessToken,
    `${DRIVE_API}/files?fields=id,name,webViewLink`,
    {
      method: "POST",
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : undefined,
      }),
    },
  );
}

async function ensureFolder(
  accessToken: string,
  name: string,
  parentId?: string,
) {
  return (
    (await findFolder(accessToken, name, parentId)) ??
    createFolder(accessToken, name, parentId)
  );
}

async function updateIntegrationMetadata(
  userId: string,
  integration: GoogleIntegrationRow,
  metadata: GoogleIntegrationRow["metadata"],
) {
  const local = await createClient();
  await local
    .from("integrations")
    .update({
      metadata: { ...(integration.metadata ?? {}), ...(metadata ?? {}) },
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id)
    .eq("user_id", userId);
}

async function ensureCurriculumFolderPath(userId: string, segments: string[]) {
  const { accessToken, integration } = await getGoogleAccessToken(userId);
  let root: DriveFile | null = integration.metadata?.root_folder_id
    ? {
        id: integration.metadata.root_folder_id,
        webViewLink: integration.metadata.root_folder_url,
      }
    : null;

  if (!root) {
    const local = await createClient();
    const { data: profile } = await local
      .from("profiles")
      .select("exam_session")
      .eq("id", userId)
      .maybeSingle();
    const session =
      typeof profile?.exam_session === "string"
        ? profile.exam_session
        : "Workspace";
    root = await ensureFolder(accessToken, `Synapse IB Workspace - ${session}`);
    await updateIntegrationMetadata(userId, integration, {
      root_folder_id: root.id,
      root_folder_url: root.webViewLink,
    });
  }

  if (!root) throw new Error("Could not create Google Drive workspace folder");

  let parentId = root.id;
  for (const segment of segments) {
    const folder = await ensureFolder(accessToken, segment, parentId);
    parentId = folder.id;
  }
  return { accessToken, folderId: parentId };
}

export async function createCurriculumGoogleDoc({
  userId,
  ownerType,
  ownerId,
  subjectId,
  title,
  folderSegments,
  seedText,
  templateType,
  selectionMethod = "created",
}: {
  userId: string;
  ownerType: CurriculumOwnerType;
  ownerId: string;
  subjectId?: string | null;
  title: string;
  folderSegments: string[];
  seedText: string;
  templateType: CurriculumDocumentTemplateType;
  selectionMethod?: CurriculumDocumentSelectionMethod;
}) {
  const { accessToken, folderId } = await ensureCurriculumFolderPath(
    userId,
    folderSegments,
  );
  const driveFile = await googleFetch<DriveFile>(
    accessToken,
    `${DRIVE_API}/files?fields=id,name,webViewLink`,
    {
      method: "POST",
      body: JSON.stringify({
        name: title,
        mimeType: GOOGLE_DOC_MIME_TYPE,
        parents: [folderId],
      }),
    },
  );

  if (seedText.trim()) {
    await googleFetch(
      accessToken,
      `${DOCS_API}/documents/${driveFile.id}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: seedText.trimEnd() + "\n",
              },
            },
          ],
        }),
      },
    );
  }

  const local = await createClient();
  const now = new Date().toISOString();
  const { data } = await local
    .from("curriculum_documents")
    .insert({
      user_id: userId,
      owner_type: ownerType,
      owner_id: ownerId,
      subject_id: subjectId ?? null,
      title,
      document_id: driveFile.id,
      document_url:
        driveFile.webViewLink ??
        `https://docs.google.com/document/d/${driveFile.id}/edit`,
      folder_id: folderId,
      source: GOOGLE_PROVIDER,
      template_type: templateType,
      selection_method: selectionMethod,
      mime_type: GOOGLE_DOC_MIME_TYPE,
      last_opened_at: null,
      last_synced_at: now,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  return data as CurriculumDocument;
}

export async function getExistingGoogleDocumentTitle(
  userId: string,
  documentId: string,
) {
  const metadata = await getExistingGoogleDocumentMetadata(userId, documentId);
  return metadata.title;
}

export async function getExistingGoogleDocumentMetadata(
  userId: string,
  documentId: string,
) {
  const { accessToken } = await getGoogleAccessToken(userId);
  const url = new URL(`${DRIVE_API}/files/${documentId}`);
  url.searchParams.set("fields", "id,name,mimeType,webViewLink");

  let metadata: DriveFile;
  try {
    metadata = await googleFetch<DriveFile>(accessToken, url.toString(), {
      method: "GET",
    });
  } catch (error) {
    if (error instanceof GoogleDriveError) {
      throw new GoogleDriveError(
        "document_inaccessible",
        "Synapse cannot access that Google document. Choose it with the Google Picker or check that this Google account can open it.",
      );
    }
    throw error;
  }

  if (metadata.mimeType !== GOOGLE_DOC_MIME_TYPE) {
    throw new GoogleDriveError(
      "document_not_google_doc",
      "Select a Google Docs document. Drive files, PDFs, Sheets, and Slides cannot be attached as curriculum documents.",
    );
  }

  const title = metadata.name?.trim();
  if (!title) throw new Error("Google did not return a document title");

  return {
    documentId: metadata.id,
    title,
    documentUrl:
      metadata.webViewLink ??
      `https://docs.google.com/document/d/${metadata.id}/edit`,
    mimeType: metadata.mimeType,
  };
}

export async function getGoogleDocumentResourceSnapshot(
  userId: string,
  documentId: string,
) {
  const { accessToken } = await getGoogleAccessToken(userId);
  const url = new URL(`${DOCS_API}/documents/${documentId}`);
  url.searchParams.set("fields", "title,body");
  const document = await googleFetch<GoogleDocumentSnapshot>(
    accessToken,
    url.toString(),
    { method: "GET" },
  );
  const title = document.title?.trim();
  if (!title) throw new Error("Google did not return a document title");
  return {
    title,
    contentText: extractGoogleDocumentPlainText(document),
    documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

export function extractGoogleDocumentPlainText(
  document: GoogleDocumentSnapshot,
) {
  const sections: string[] = [];
  collectGoogleDocumentContent(document.body?.content ?? [], sections);
  return sections
    .join("\n")
    .replace(/\u000b/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectGoogleDocumentContent(
  elements: GoogleStructuralElement[],
  sections: string[],
) {
  for (const element of elements) {
    if (element.paragraph) {
      const text = (element.paragraph.elements ?? [])
        .map((part) => part.textRun?.content ?? "")
        .join("")
        .trimEnd();
      if (text.trim()) sections.push(text);
    }

    if (element.table) {
      const rows = (element.table.tableRows ?? [])
        .map((row) =>
          (row.tableCells ?? [])
            .map((cell) => {
              const cellSections: string[] = [];
              collectGoogleDocumentContent(cell.content ?? [], cellSections);
              return cellSections.join(" ").trim();
            })
            .filter(Boolean)
            .join("\t"),
        )
        .filter(Boolean);
      if (rows.length > 0) sections.push(rows.join("\n"));
    }

    if (element.tableOfContents?.content) {
      collectGoogleDocumentContent(element.tableOfContents.content, sections);
    }
  }
}

export function parseGoogleDocumentId(url: string) {
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  const match =
    trimmed.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/) ??
    trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ??
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}
