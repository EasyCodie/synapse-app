import { promises as fs } from "fs";
import path from "path";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
type Db = Record<string, Row[]>;
type LocalResult = {
  data: any;
  error: { message: string } | null;
  count?: number | null;
};

const DATA_DIR = path.join(process.cwd(), ".synapse-data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const PERSONAL_USER = {
  id: "personal-user",
  email: "local@synapse",
  user_metadata: { full_name: "Ivan" },
};

const TABLES = [
  "profiles",
  "user_subjects",
  "workspaces",
  "notes",
  "syllabus_progress",
  "internal_assessments",
  "tasks",
  "milestones",
  "resources",
  "chat_conversations",
  "chat_messages",
  "embeddings",
  "ee_tracker",
  "tok_tracker",
  "cas_experiences",
  "integrations",
  "curriculum_documents",
  "flashcards",
  "roadmap_items",
  "roadmap_insights",
  "school_schedule_entries",
];

function emptyDb(): Db {
  return Object.fromEntries(TABLES.map((table) => [table, []]));
}

let dbWriteQueue: Promise<unknown> = Promise.resolve();

function now() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomUUID();
}

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  try {
    await fs.access(DB_PATH);
  } catch {
    const db = emptyDb();
    db.profiles.push({
      id: PERSONAL_USER.id,
      full_name: PERSONAL_USER.user_metadata.full_name,
      exam_session: null,
      onboarding_complete: false,
      created_at: now(),
    });
    await writeDbFile(db);
  }
}

async function writeDbFile(db: Db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const tempPath = path.join(
    DATA_DIR,
    `db.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`,
  );
  await fs.writeFile(tempPath, JSON.stringify(db, null, 2));
  await replaceFile(tempPath, DB_PATH);
}

async function replaceFile(tempPath: string, targetPath: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fs.rename(tempPath, targetPath);
      return;
    } catch (error) {
      const code =
        error instanceof Error && "code" in error ? error.code : null;
      if (code !== "EPERM" && code !== "EEXIST") throw error;
      await fs.rm(targetPath, { force: true });
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }

  await fs.rename(tempPath, targetPath);
}

function createInitialDb() {
  const db = emptyDb();
  db.profiles.push({
    id: PERSONAL_USER.id,
    full_name: PERSONAL_USER.user_metadata.full_name,
    exam_session: null,
    onboarding_complete: false,
    created_at: now(),
  });
  return db;
}

async function backupMalformedDb(raw: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(DATA_DIR, `db.malformed-${stamp}.json`);
  await fs.writeFile(backupPath, raw);
  return backupPath;
}

async function readDb(): Promise<Db> {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf8");
  try {
    return { ...emptyDb(), ...JSON.parse(raw) };
  } catch {
    await backupMalformedDb(raw);
    const recovered = createInitialDb();
    await writeDbFile(recovered);
    return recovered;
  }
}

async function writeDb(db: Db) {
  return enqueueDbWrite(async () => {
    await writeDbFile({ ...emptyDb(), ...db });
  });
}

async function enqueueDbWrite<T>(operation: () => Promise<T>): Promise<T> {
  const run = dbWriteQueue.then(operation, operation);
  dbWriteQueue = run.catch(() => undefined);
  return run;
}

function resolveUploadPath(filePath: string) {
  const normalized = filePath.replaceAll("\\", "/").replace(/^\/+/, "");
  const target = path.resolve(UPLOAD_DIR, normalized);
  const uploadRoot = path.resolve(UPLOAD_DIR);
  if (target !== uploadRoot && !target.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new Error("Unsafe upload path");
  }
  return target;
}

function matches(row: Row, filters: Filter[]) {
  return filters.every((filter) => {
    const value = row[filter.column];
    switch (filter.op) {
      case "eq":
        return value === filter.value;
      case "gte":
        return value >= filter.value;
      case "lte":
        return value <= filter.value;
      case "in":
        return Array.isArray(filter.value) && filter.value.includes(value);
      case "ilike": {
        const needle = String(filter.value).replaceAll("%", "").toLowerCase();
        return String(value ?? "")
          .toLowerCase()
          .includes(needle);
      }
    }
  });
}

function project(rows: Row[], columns: string | null) {
  if (!columns || columns === "*" || columns.includes("(")) return rows;
  const keys = columns
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
  return rows.map((row) =>
    Object.fromEntries(keys.map((key) => [key, row[key]])),
  );
}

function withDefaults(table: string, row: Row) {
  const stamped: Row = {
    id: row.id ?? createId(),
    created_at: row.created_at ?? now(),
    ...row,
  };

  if (table === "profiles") {
    stamped.onboarding_complete ??= false;
  }
  if (table === "tasks") {
    stamped.description ??= null;
    stamped.due_date ??= null;
    stamped.due_time ??= null;
    stamped.priority ??= "medium";
    stamped.completed ??= false;
    stamped.subject_id ??= null;
    stamped.source_title ??= null;
    stamped.source_url ??= null;
    stamped.updated_at ??= stamped.created_at;
  }
  if (table === "milestones") {
    stamped.type ??= "custom";
  }
  if (table === "resources") {
    stamped.tags ??= [];
    stamped.type ??= "other";
  }
  if (table === "flashcards") {
    stamped.tags ??= [];
    stamped.confidence ??= 0;
    stamped.next_review ??= now();
  }
  if (table === "chat_conversations") {
    stamped.title ??= "New chat";
    stamped.updated_at ??= stamped.created_at;
    stamped.last_message_at ??= stamped.created_at;
  }
  if (table === "internal_assessments") {
    stamped.status ??= "not_started";
    stamped.word_count ??= 0;
    stamped.draft_versions ??= [];
    stamped.updated_at ??= stamped.created_at;
  }
  if (table === "ee_tracker") {
    stamped.word_count ??= 0;
    stamped.status ??= "not_started";
    stamped.milestones ??= [];
  }
  if (table === "tok_tracker") {
    stamped.exhibition_objects ??= [];
    stamped.status ??= "not_started";
  }
  if (table === "cas_experiences") {
    stamped.learning_outcomes ??= [];
    stamped.reflections ??= [];
    stamped.status ??= "planned";
  }
  if (table === "integrations") {
    stamped.updated_at ??= stamped.created_at;
  }
  if (table === "curriculum_documents") {
    stamped.source ??= "google_drive";
    stamped.updated_at ??= stamped.created_at;
  }
  if (table === "roadmap_items") {
    stamped.category ??= "custom";
    stamped.status ??= "upcoming";
    stamped.priority ??= "medium";
    stamped.source_type ??= "custom";
    stamped.manual_override ??= false;
    stamped.hidden ??= false;
    stamped.updated_at ??= stamped.created_at;
  }
  if (table === "roadmap_insights") {
    stamped.next_actions ??= [];
    stamped.risk_flags ??= [];
    stamped.generated_at ??= stamped.created_at;
  }
  if (table === "school_schedule_entries") {
    stamped.subject_id ??= null;
    stamped.room ??= null;
    stamped.teacher ??= null;
    stamped.updated_at ??= stamped.created_at;
  }

  return stamped;
}

type Filter = {
  op: "eq" | "gte" | "lte" | "in" | "ilike";
  column: string;
  value: any;
};

class LocalQuery {
  private filters: Filter[] = [];
  private selected: string | null = null;
  private selectOptions: { count?: "exact"; head?: boolean } = {};
  private orderBy: { column: string; ascending: boolean } | null = null;
  private maxRows: number | null = null;
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private singleMode: "single" | "maybeSingle" | null = null;

  constructor(private table: string) {}

  select(columns = "*", options: { count?: "exact"; head?: boolean } = {}) {
    this.selected = columns;
    this.selectOptions = options;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  upsert(payload: Row | Row[], options: { onConflict?: string } = {}) {
    this.mode = "insert";
    this.payload = payload;
    (this as any).onConflict = options.onConflict;
    return this;
  }

  update(payload: Row) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ op: "gte", column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ op: "lte", column, value });
    return this;
  }

  in(column: string, value: any[]) {
    this.filters.push({ op: "in", column, value });
    return this;
  }

  ilike(column: string, value: string) {
    this.filters.push({ op: "ilike", column, value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderBy = { column, ascending: options.ascending ?? true };
    return this;
  }

  limit(value: number) {
    this.maxRows = value;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  async execute() {
    if (this.mode !== "select") {
      return enqueueDbWrite(async () => this.executeWrite());
    }

    const db = await readDb();
    db[this.table] ??= [];
    const rows = db[this.table].filter((row) => matches(row, this.filters));

    return this.finalizeRows(rows);
  }

  private async executeWrite() {
    const db = await readDb();
    db[this.table] ??= [];
    let rows = db[this.table];

    if (this.mode === "insert") {
      const incoming = Array.isArray(this.payload)
        ? this.payload
        : [this.payload ?? {}];
      const conflictKeys = String((this as any).onConflict ?? "id")
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);
      const saved: Row[] = [];

      for (const row of incoming) {
        const prepared = withDefaults(this.table, row);
        const existingIndex = rows.findIndex((candidate) =>
          conflictKeys.every((key) => candidate[key] === prepared[key]),
        );
        if (existingIndex >= 0) {
          rows[existingIndex] = { ...rows[existingIndex], ...prepared };
          saved.push(rows[existingIndex]);
        } else {
          rows.push(prepared);
          saved.push(prepared);
        }
      }
      await writeDbFile(db);
      rows = saved;
    } else if (this.mode === "update") {
      const changed: Row[] = [];
      rows = rows.map((row) => {
        if (!matches(row, this.filters)) return row;
        const updated = {
          ...row,
          ...(this.payload as Row),
          updated_at: (this.payload as Row)?.updated_at ?? row.updated_at,
        };
        changed.push(updated);
        return updated;
      });
      db[this.table] = rows;
      await writeDbFile(db);
      rows = changed;
    } else if (this.mode === "delete") {
      const before = rows.length;
      db[this.table] = rows.filter((row) => !matches(row, this.filters));
      await writeDbFile(db);
      rows = [];
      return { data: null, error: null, count: before - db[this.table].length };
    }

    return this.finalizeRows(rows);
  }

  private finalizeRows(rows: Row[]) {
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows = [...rows].sort((a, b) => {
        const left = a[column] ?? "";
        const right = b[column] ?? "";
        if (left === right) return 0;
        return (left > right ? 1 : -1) * (ascending ? 1 : -1);
      });
    }

    const count = rows.length;
    if (this.maxRows !== null) rows = rows.slice(0, this.maxRows);
    rows = project(rows, this.selected);

    if (this.selectOptions.head) {
      return { data: null, error: null, count };
    }

    if (this.singleMode) {
      const row = rows[0] ?? null;
      if (!row && this.singleMode === "single") {
        return { data: null, error: { message: "No rows found" }, count };
      }
      return { data: row, error: null, count };
    }

    return { data: rows, error: null, count };
  }

  then<TResult1 = LocalResult, TResult2 = never>(
    onfulfilled?:
      | ((value: LocalResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function getLocalDb() {
  return readDb();
}

export async function writeLocalDb(db: Db) {
  return writeDb(db);
}

export function getLocalDataPaths() {
  return {
    dataDir: DATA_DIR,
    dbPath: DB_PATH,
    uploadDir: UPLOAD_DIR,
  };
}

export async function createClient() {
  return {
    auth: {
      async getUser() {
        return { data: { user: PERSONAL_USER }, error: null };
      },
      async signOut() {
        return { error: null };
      },
      async signInWithPassword() {
        return { data: { user: PERSONAL_USER }, error: null };
      },
      async signInWithOAuth() {
        return { data: null, error: null };
      },
      async signUp() {
        return { data: { user: PERSONAL_USER }, error: null };
      },
      async exchangeCodeForSession() {
        return { error: null };
      },
    },
    from(table: string) {
      return new LocalQuery(table);
    },
    async rpc(name: string, args: any) {
      if (name !== "search_embeddings") {
        return { data: null, error: { message: `Unknown local RPC: ${name}` } };
      }
      const db = await readDb();
      const results = (db.embeddings ?? [])
        .filter((row) => row.user_id === args.match_user_id)
        .map((row) => ({
          id: row.id,
          source_type: row.source_type,
          source_id: row.source_id,
          content_text: row.content_text,
          metadata: row.metadata ?? {},
          similarity: Array.isArray(row.embedding)
            ? cosineSimilarity(args.query_embedding ?? [], row.embedding)
            : 0,
        }))
        .filter((row) => row.similarity >= (args.match_threshold ?? 0))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, args.match_count ?? 6);
      return { data: results, error: null };
    },
    storage: {
      from(bucket?: string) {
        void bucket;
        return {
          async upload(filePath: string, file: Blob, options?: unknown) {
            void options;
            const target = resolveUploadPath(filePath);
            await fs.mkdir(path.dirname(target), { recursive: true });
            const buffer = Buffer.from(await file.arrayBuffer());
            await fs.writeFile(target, buffer);
            return { data: { path: filePath }, error: null };
          },
          async download(filePath: string) {
            try {
              const buffer = await fs.readFile(resolveUploadPath(filePath));
              return { data: new Blob([buffer]), error: null };
            } catch (error) {
              return {
                data: null,
                error: {
                  message:
                    error instanceof Error ? error.message : "Download failed",
                },
              };
            }
          },
          async remove(paths: string[]) {
            for (const filePath of paths) {
              await fs.rm(resolveUploadPath(filePath), { force: true });
            }
            return { data: null, error: null };
          },
        };
      },
    },
  };
}

export function createBrowserClient() {
  return {
    auth: {
      async getUser() {
        return { data: { user: PERSONAL_USER }, error: null };
      },
      async signInWithPassword() {
        return { data: { user: PERSONAL_USER }, error: null };
      },
      async signInWithOAuth() {
        window.location.href = "/dashboard";
        return { data: null, error: null };
      },
      async signUp() {
        return { data: { user: PERSONAL_USER }, error: null };
      },
    },
  };
}
