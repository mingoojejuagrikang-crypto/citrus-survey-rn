import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('citrus_survey.db');
    await initDB(db);
  }
  return db;
}

async function initDB(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS samples (
      sample_id TEXT PRIMARY KEY,
      survey_date TEXT NOT NULL,
      survey_type TEXT NOT NULL,
      farm_name TEXT NOT NULL,
      label TEXT DEFAULT '',
      treatment TEXT DEFAULT '',
      tree_no INTEGER DEFAULT 1,
      fruit_no INTEGER NOT NULL,
      memo TEXT DEFAULT '',
      observer TEXT DEFAULT '',
      sync_status INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS measurements (
      measurement_id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL REFERENCES samples(sample_id),
      item_name TEXT NOT NULL,
      item_value REAL,
      input_method TEXT DEFAULT 'manual',
      raw_voice_text TEXT DEFAULT '',
      audio_clip_path TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(sample_id, item_name)
    );

    CREATE TABLE IF NOT EXISTS history_cache (
      cache_id TEXT PRIMARY KEY,
      year TEXT NOT NULL,
      farm_name TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      data_json TEXT NOT NULL,
      downloaded_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_sample_key
      ON samples(survey_date, farm_name, tree_no, fruit_no);
    CREATE INDEX IF NOT EXISTS idx_sample_sync
      ON samples(sync_status);
    CREATE INDEX IF NOT EXISTS idx_history
      ON history_cache(year, farm_name);
    CREATE INDEX IF NOT EXISTS idx_measurement_sample
      ON measurements(sample_id);
  `);
}

// ─── Config ─────────────────────────────────────────────────────────────────

export async function getConfig(key: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM config WHERE key = ?', [key]
  );
  return row?.value ?? null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
    [key, value]
  );
}

export async function getAllConfig(): Promise<Record<string, string>> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM config'
  );
  const result: Record<string, string> = {};
  rows.forEach(r => { result[r.key] = r.value; });
  return result;
}

// ─── Samples ─────────────────────────────────────────────────────────────────

export interface Sample {
  sample_id: string;
  survey_date: string;
  survey_type: string;
  farm_name: string;
  label: string;
  treatment: string;
  tree_no: number;
  fruit_no: number;
  memo: string;
  observer: string;
  sync_status: number;
  created_at: string;
  updated_at: string;
}

export async function upsertSample(sample: Sample): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO samples
      (sample_id, survey_date, survey_type, farm_name, label, treatment,
       tree_no, fruit_no, memo, observer, sync_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))`,
    [
      sample.sample_id, sample.survey_date, sample.survey_type,
      sample.farm_name, sample.label, sample.treatment,
      sample.tree_no, sample.fruit_no, sample.memo,
      sample.observer, sample.sync_status, sample.created_at,
    ]
  );
}

export async function getSample(
  surveyDate: string, farmName: string, treeNo: number, fruitNo: number
): Promise<Sample | null> {
  const db = await getDB();
  return await db.getFirstAsync<Sample>(
    `SELECT * FROM samples
     WHERE survey_date = ? AND farm_name = ? AND tree_no = ? AND fruit_no = ?
     ORDER BY created_at DESC LIMIT 1`,
    [surveyDate, farmName, treeNo, fruitNo]
  );
}

export async function getSampleById(sampleId: string): Promise<Sample | null> {
  const db = await getDB();
  return await db.getFirstAsync<Sample>(
    'SELECT * FROM samples WHERE sample_id = ?', [sampleId]
  );
}

export async function getAllSamples(): Promise<Sample[]> {
  const db = await getDB();
  return await db.getAllAsync<Sample>(
    'SELECT * FROM samples ORDER BY created_at DESC'
  );
}

export async function getUnsyncedSamples(): Promise<Sample[]> {
  const db = await getDB();
  return await db.getAllAsync<Sample>(
    'SELECT * FROM samples WHERE sync_status = 0 ORDER BY created_at ASC'
  );
}

export async function markSampleSynced(sampleId: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE samples SET sync_status = 1, updated_at = datetime('now','localtime')
     WHERE sample_id = ?`,
    [sampleId]
  );
}

export async function updateSampleMemo(sampleId: string, memo: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE samples SET memo = ?, sync_status = 0, updated_at = datetime('now','localtime')
     WHERE sample_id = ?`,
    [memo, sampleId]
  );
}

// ─── Measurements ─────────────────────────────────────────────────────────────

export interface Measurement {
  measurement_id: string;
  sample_id: string;
  item_name: string;
  item_value: number | null;
  input_method: string;
  raw_voice_text: string;
  audio_clip_path: string;
  updated_at: string;
}

export async function upsertMeasurement(m: Measurement): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO measurements
      (measurement_id, sample_id, item_name, item_value, input_method, raw_voice_text, audio_clip_path, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
     ON CONFLICT(sample_id, item_name) DO UPDATE SET
       item_value = excluded.item_value,
       input_method = excluded.input_method,
       raw_voice_text = excluded.raw_voice_text,
       audio_clip_path = excluded.audio_clip_path,
       updated_at = datetime('now','localtime')`,
    [
      m.measurement_id, m.sample_id, m.item_name,
      m.item_value, m.input_method, m.raw_voice_text, m.audio_clip_path,
    ]
  );
  // mark sample unsynced
  await db.runAsync(
    `UPDATE samples SET sync_status = 0, updated_at = datetime('now','localtime')
     WHERE sample_id = ?`,
    [m.sample_id]
  );
}

export async function getMeasurements(sampleId: string): Promise<Measurement[]> {
  const db = await getDB();
  return await db.getAllAsync<Measurement>(
    'SELECT * FROM measurements WHERE sample_id = ? ORDER BY item_name',
    [sampleId]
  );
}

export async function getMeasurementsMap(sampleId: string): Promise<Record<string, number>> {
  const measurements = await getMeasurements(sampleId);
  const map: Record<string, number> = {};
  measurements.forEach(m => {
    if (m.item_value !== null) map[m.item_name] = m.item_value;
  });
  return map;
}

// ─── History Cache ───────────────────────────────────────────────────────────

export async function saveHistoryCache(
  year: string,
  farmName: string,
  sheetName: string,
  dataJson: string
): Promise<void> {
  const db = await getDB();
  const cacheId = `${year}_${farmName}_${sheetName}`;
  await db.runAsync(
    `INSERT OR REPLACE INTO history_cache
      (cache_id, year, farm_name, sheet_name, data_json, downloaded_at)
     VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))`,
    [cacheId, year, farmName, sheetName, dataJson]
  );
}

export async function getHistoryCache(
  year: string,
  farmName: string
): Promise<{ sheetName: string; data: Record<string, unknown>[] }[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ sheet_name: string; data_json: string }>(
    'SELECT sheet_name, data_json FROM history_cache WHERE year = ? AND farm_name = ?',
    [year, farmName]
  );
  return rows.map(r => ({
    sheetName: r.sheet_name,
    data: JSON.parse(r.data_json),
  }));
}

// ─── Stats / Progress ─────────────────────────────────────────────────────────

export async function getSamplesForDate(surveyDate: string): Promise<Sample[]> {
  const db = await getDB();
  return await db.getAllAsync<Sample>(
    'SELECT * FROM samples WHERE survey_date = ? ORDER BY farm_name, tree_no, fruit_no',
    [surveyDate]
  );
}

export async function getSamplesForFarm(farmName: string): Promise<Sample[]> {
  const db = await getDB();
  return await db.getAllAsync<Sample>(
    'SELECT * FROM samples WHERE farm_name = ? ORDER BY survey_date DESC, tree_no, fruit_no',
    [farmName]
  );
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.execAsync(`
    DELETE FROM measurements;
    DELETE FROM samples;
    DELETE FROM history_cache;
  `);
}
