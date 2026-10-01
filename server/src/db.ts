import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createClient, type Client, type InStatement } from "@libsql/client";
import { projectFactsSchema, type ProjectFacts } from "./facts.js";
import type { FactChange } from "./changes.js";

export type CheckStatus = "pending" | "ok" | "error";
export type UpdateKind = "first_snapshot" | "facts_changed" | "page_changed";

export interface Project {
  id: string;
  nickname: string;
  url: string;
  createdAt: string;
  lastCheckedAt: string | null;
  checkStatus: CheckStatus;
  lastError: string | null;
  facts: ProjectFacts | null;
  updateCount: number;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  detectedAt: string;
  kind: UpdateKind;
  summary: string;
  factChanges: FactChange[];
  addedLines: string[];
  removedLines: string[];
}

export interface Snapshot {
  contentHash: string | null;
  lines: string[];
  facts: ProjectFacts | null;
}

export interface CheckResult {
  contentHash: string;
  lines: string[];
  facts: ProjectFacts | null;
  update: Omit<ProjectUpdate, "id" | "projectId" | "detectedAt"> | null;
}

/** Keep stored diffs small: the app only shows a preview. */
const MAX_STORED_DIFF_LINES = 40;

interface ProjectRow {
  id: string;
  nickname: string;
  url: string;
  created_at: string;
  last_checked_at: string | null;
  check_status: CheckStatus;
  last_error: string | null;
  facts_json: string | null;
  update_count: number;
}

interface UpdateRow {
  id: string;
  project_id: string;
  detected_at: string;
  kind: UpdateKind;
  summary: string;
  fact_changes_json: string;
  added_lines_json: string;
  removed_lines_json: string;
}

function parseFacts(json: string | null): ProjectFacts | null {
  if (!json) return null;
  const parsed = projectFactsSchema.safeParse(JSON.parse(json));
  return parsed.success ? parsed.data : null;
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    nickname: row.nickname,
    url: row.url,
    createdAt: row.created_at,
    lastCheckedAt: row.last_checked_at,
    checkStatus: row.check_status,
    lastError: row.last_error,
    facts: parseFacts(row.facts_json),
    updateCount: Number(row.update_count),
  };
}

function toUpdate(row: UpdateRow): ProjectUpdate {
  return {
    id: row.id,
    projectId: row.project_id,
    detectedAt: row.detected_at,
    kind: row.kind,
    summary: row.summary,
    factChanges: JSON.parse(row.fact_changes_json) as FactChange[],
    addedLines: JSON.parse(row.added_lines_json) as string[],
    removedLines: JSON.parse(row.removed_lines_json) as string[],
  };
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_checked_at TEXT,
    check_status TEXT NOT NULL DEFAULT 'pending',
    last_error TEXT,
    content_hash TEXT,
    snapshot_lines_json TEXT,
    facts_json TEXT
  );

  CREATE TABLE IF NOT EXISTS project_updates (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    detected_at TEXT NOT NULL,
    kind TEXT NOT NULL,
    summary TEXT NOT NULL,
    fact_changes_json TEXT NOT NULL,
    added_lines_json TEXT NOT NULL,
    removed_lines_json TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_updates_project ON project_updates(project_id, detected_at DESC);
`;

export interface StoreOptions {
  /** libSQL URL: `file:./data/app.db` locally, `libsql://<db>.turso.io` in production, `:memory:` in tests. */
  url: string;
  /** Required for a remote Turso database. */
  authToken?: string;
}

const PROJECT_COLUMNS = `
  p.id, p.nickname, p.url, p.created_at, p.last_checked_at, p.check_status, p.last_error, p.facts_json,
  (SELECT COUNT(*) FROM project_updates u WHERE u.project_id = p.id) AS update_count`;

export class Store {
  private constructor(private readonly db: Client) {}

  /** Opens the database and creates the schema if needed. */
  static async open({ url, authToken }: StoreOptions): Promise<Store> {
    if (url.startsWith("file:")) mkdirSync(dirname(fileURLToPath(new URL(url, `file://${process.cwd()}/`))), { recursive: true });
    const store = new Store(createClient({ url, authToken }));
    await store.db.executeMultiple(SCHEMA);
    return store;
  }

  close(): void {
    this.db.close();
  }

  private async first<T>(stmt: InStatement): Promise<T | undefined> {
    const result = await this.db.execute(stmt);
    return result.rows[0] as T | undefined;
  }

  private async all<T>(stmt: InStatement): Promise<T[]> {
    const result = await this.db.execute(stmt);
    return result.rows as unknown as T[];
  }

  async countProjects(): Promise<number> {
    const row = await this.first<{ count: number }>("SELECT COUNT(*) AS count FROM projects");
    return Number(row?.count ?? 0);
  }

  async listProjects(): Promise<Project[]> {
    const rows = await this.all<ProjectRow>(`SELECT ${PROJECT_COLUMNS} FROM projects p ORDER BY p.created_at DESC`);
    return rows.map(toProject);
  }

  async listProjectIds(): Promise<string[]> {
    const rows = await this.all<{ id: string }>("SELECT id FROM projects");
    return rows.map((row) => row.id);
  }

  async getProject(id: string): Promise<Project | null> {
    const row = await this.first<ProjectRow>({ sql: `SELECT ${PROJECT_COLUMNS} FROM projects p WHERE p.id = ?`, args: [id] });
    return row ? toProject(row) : null;
  }

  async findProjectByUrl(url: string): Promise<Project | null> {
    const row = await this.first<ProjectRow>({ sql: `SELECT ${PROJECT_COLUMNS} FROM projects p WHERE p.url = ?`, args: [url] });
    return row ? toProject(row) : null;
  }

  async createProject(input: { nickname: string; url: string }): Promise<Project> {
    const id = randomUUID();
    await this.db.execute({
      sql: "INSERT INTO projects (id, nickname, url, created_at) VALUES (?, ?, ?, ?)",
      args: [id, input.nickname, input.url, new Date().toISOString()],
    });
    return (await this.getProject(id))!;
  }

  async deleteProject(id: string): Promise<boolean> {
    // Deletes updates explicitly: foreign-key enforcement is per connection and not guaranteed on remote libSQL.
    const [, deleted] = await this.db.batch(
      [
        { sql: "DELETE FROM project_updates WHERE project_id = ?", args: [id] },
        { sql: "DELETE FROM projects WHERE id = ?", args: [id] },
      ],
      "write",
    );
    return (deleted?.rowsAffected ?? 0) > 0;
  }

  async markCheckPending(id: string): Promise<void> {
    await this.db.execute({ sql: "UPDATE projects SET check_status = 'pending', last_error = NULL WHERE id = ?", args: [id] });
  }

  async markCheckFailed(id: string, message: string): Promise<void> {
    await this.db.execute({
      sql: "UPDATE projects SET check_status = 'error', last_error = ?, last_checked_at = ? WHERE id = ?",
      args: [message.slice(0, 500), new Date().toISOString(), id],
    });
  }

  async getSnapshot(id: string): Promise<Snapshot | null> {
    const row = await this.first<{ content_hash: string | null; snapshot_lines_json: string | null; facts_json: string | null }>({
      sql: "SELECT content_hash, snapshot_lines_json, facts_json FROM projects WHERE id = ?",
      args: [id],
    });
    if (!row) return null;
    return {
      contentHash: row.content_hash,
      lines: row.snapshot_lines_json ? (JSON.parse(row.snapshot_lines_json) as string[]) : [],
      facts: parseFacts(row.facts_json),
    };
  }

  /** Persists a completed check atomically: the new snapshot and, if anything changed, one update entry. */
  async recordCheck(id: string, result: CheckResult): Promise<void> {
    const now = new Date().toISOString();
    const statements: InStatement[] = [
      {
        sql: `UPDATE projects
                SET content_hash = ?, snapshot_lines_json = ?, facts_json = COALESCE(?, facts_json),
                    last_checked_at = ?, check_status = 'ok', last_error = NULL
              WHERE id = ?`,
        args: [result.contentHash, JSON.stringify(result.lines), result.facts ? JSON.stringify(result.facts) : null, now, id],
      },
    ];

    if (result.update) {
      statements.push({
        sql: `INSERT INTO project_updates
                (id, project_id, detected_at, kind, summary, fact_changes_json, added_lines_json, removed_lines_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          randomUUID(),
          id,
          now,
          result.update.kind,
          result.update.summary,
          JSON.stringify(result.update.factChanges),
          JSON.stringify(result.update.addedLines.slice(0, MAX_STORED_DIFF_LINES)),
          JSON.stringify(result.update.removedLines.slice(0, MAX_STORED_DIFF_LINES)),
        ],
      });
    }

    await this.db.batch(statements, "write");
  }

  async listUpdates(projectId: string, limit = 50): Promise<ProjectUpdate[]> {
    const rows = await this.all<UpdateRow>({
      sql: "SELECT * FROM project_updates WHERE project_id = ? ORDER BY detected_at DESC LIMIT ?",
      args: [projectId, limit],
    });
    return rows.map(toUpdate);
  }
}
