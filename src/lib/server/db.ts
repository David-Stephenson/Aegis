import fs from 'node:fs';
import path from 'node:path';
import { Database } from 'bun:sqlite';
import { appEnv } from '$lib/server/env';

const dbPath = path.resolve(appEnv.DB_PATH);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath, { create: true });
db.run('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS allowlist_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_email TEXT,
  service_id TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(service_id, ip)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  correlation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_email TEXT,
  groups_json TEXT NOT NULL,
  service_id TEXT NOT NULL,
  ip TEXT NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_overrides (
  service_id TEXT PRIMARY KEY,
  display_name TEXT,
  description TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1000,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

const auditColumns = db.prepare('PRAGMA table_info(audit_events)').all() as Array<{ name: string }>;
const hasGroupsJson = auditColumns.some((column) => column.name === 'groups_json');
const hasLegacyRolesJson = auditColumns.some((column) => column.name === 'roles_json');

if (!hasGroupsJson) {
	db.exec("ALTER TABLE audit_events ADD COLUMN groups_json TEXT NOT NULL DEFAULT '[]'");
}

if (hasLegacyRolesJson) {
	db.exec("UPDATE audit_events SET groups_json = roles_json WHERE groups_json = '[]'");
}

export { db };
