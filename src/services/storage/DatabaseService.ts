import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';

import { DEFAULT_FARMS, DEFAULT_WEB_APP_URL } from '../../constants/app';
import { DEFAULT_VALUE_RANGES, SURVEY_TYPE_ITEMS } from '../../constants/items';
import type {
  ComparisonRow,
  CustomTerm,
  HistoryCacheRow,
  MeasurementItemName,
  MeasurementRecord,
  ParsedIntent,
  ProgressSummary,
  SessionContext,
  SurveyRecordListItem,
  SyncPayloadRow,
  ValueRange,
} from '../../types/domain';
import { formatTimestamp } from '../../utils/date';
import { getDeltaSeverity, getRangeStatus } from '../../utils/range';
import { resolveUndoValue } from '../../utils/undo';

const DB_NAME = 'citrus-survey.db';
const DB_VERSION = 1;

type ConfigRow = {
  key: string;
  value: string;
};

class DatabaseService {
  private databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

  private getDatabase() {
    if (!this.databasePromise) {
      this.databasePromise = SQLite.openDatabaseAsync(DB_NAME);
    }
    return this.databasePromise;
  }

  async initialize() {
    const db = await this.getDatabase();
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS samples (
        id TEXT PRIMARY KEY NOT NULL,
        survey_date TEXT NOT NULL,
        observer TEXT NOT NULL,
        farm_name TEXT NOT NULL,
        label TEXT NOT NULL,
        treatment TEXT NOT NULL,
        survey_type TEXT NOT NULL,
        tree_no INTEGER NOT NULL,
        fruit_no INTEGER NOT NULL,
        sync_status INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_synced_at TEXT,
        UNIQUE (survey_date, farm_name, label, treatment, tree_no, fruit_no)
      );
      CREATE TABLE IF NOT EXISTS measurements (
        id TEXT PRIMARY KEY NOT NULL,
        sample_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        item_type TEXT NOT NULL,
        numeric_value REAL,
        text_value TEXT,
        raw_voice_text TEXT NOT NULL,
        is_out_of_range INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        UNIQUE (sample_id, item_name),
        FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS history_cache (
        id TEXT PRIMARY KEY NOT NULL,
        survey_date TEXT NOT NULL,
        farm_name TEXT NOT NULL,
        label TEXT NOT NULL,
        treatment TEXT NOT NULL,
        tree_no INTEGER NOT NULL,
        fruit_no INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        value REAL NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS undo_stack (
        id TEXT PRIMARY KEY NOT NULL,
        sample_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        previous_numeric_value REAL,
        previous_text_value TEXT,
        raw_voice_text TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS custom_terms (
        id TEXT PRIMARY KEY NOT NULL,
        alias TEXT NOT NULL,
        canonical TEXT NOT NULL,
        category TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS value_ranges (
        item_name TEXT PRIMARY KEY NOT NULL,
        min_value REAL NOT NULL,
        max_value REAL NOT NULL,
        warning_message TEXT NOT NULL
      );
      PRAGMA user_version = ${DB_VERSION};
    `);

    await this.seedDefaults();
  }

  private async seedDefaults() {
    const db = await this.getDatabase();
    const currentConfigs = await db.getAllAsync<ConfigRow>('SELECT key, value FROM config');
    const configMap = new Map(currentConfigs.map((row) => [row.key, row.value]));

    if (!configMap.has('observer')) {
      await db.runAsync('INSERT INTO config (key, value) VALUES (?, ?)', 'observer', '');
    }
    if (!configMap.has('webAppUrl')) {
      await db.runAsync(
        'INSERT INTO config (key, value) VALUES (?, ?)',
        'webAppUrl',
        DEFAULT_WEB_APP_URL
      );
    }
    if (!configMap.has('farms')) {
      await db.runAsync('INSERT INTO config (key, value) VALUES (?, ?)', 'farms', JSON.stringify(DEFAULT_FARMS));
    }
    if (!configMap.has('enabled_items')) {
      await db.runAsync(
        'INSERT INTO config (key, value) VALUES (?, ?)',
        'enabled_items',
        JSON.stringify(SURVEY_TYPE_ITEMS)
      );
    }

    const countRow = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM value_ranges'
    );
    if (!countRow || countRow.count === 0) {
      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const range of DEFAULT_VALUE_RANGES) {
          await txn.runAsync(
            'INSERT INTO value_ranges (item_name, min_value, max_value, warning_message) VALUES (?, ?, ?, ?)',
            range.itemName,
            range.minValue,
            range.maxValue,
            range.warningMessage
          );
        }
      });
    }
  }

  async getConfigMap() {
    const db = await this.getDatabase();
    const rows = await db.getAllAsync<ConfigRow>('SELECT key, value FROM config');
    return rows.reduce<Record<string, string>>((accumulator, row) => {
      accumulator[row.key] = row.value;
      return accumulator;
    }, {});
  }

  async setConfigValue(key: string, value: string) {
    const db = await this.getDatabase();
    await db.runAsync(
      'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value
    );
  }

  async getValueRanges(): Promise<ValueRange[]> {
    const db = await this.getDatabase();
    const rows = await db.getAllAsync<{
      item_name: MeasurementItemName;
      min_value: number;
      max_value: number;
      warning_message: string;
    }>('SELECT item_name, min_value, max_value, warning_message FROM value_ranges ORDER BY item_name');

    return rows.map((row) => ({
      itemName: row.item_name,
      minValue: row.min_value,
      maxValue: row.max_value,
      warningMessage: row.warning_message,
    }));
  }

  async upsertValueRange(range: ValueRange) {
    const db = await this.getDatabase();
    await db.runAsync(
      `INSERT INTO value_ranges (item_name, min_value, max_value, warning_message)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(item_name) DO UPDATE SET
         min_value = excluded.min_value,
         max_value = excluded.max_value,
         warning_message = excluded.warning_message`,
      range.itemName,
      range.minValue,
      range.maxValue,
      range.warningMessage
    );
  }

  async listCustomTerms(): Promise<CustomTerm[]> {
    const db = await this.getDatabase();
    return db.getAllAsync<CustomTerm>(
      'SELECT id, alias, canonical, category FROM custom_terms ORDER BY canonical, alias'
    );
  }

  async addCustomTerm(term: Omit<CustomTerm, 'id'>) {
    const db = await this.getDatabase();
    await db.runAsync(
      'INSERT INTO custom_terms (id, alias, canonical, category) VALUES (?, ?, ?, ?)',
      uuidv4(),
      term.alias,
      term.canonical,
      term.category
    );
  }

  private async ensureSample(session: SessionContext) {
    const db = await this.getDatabase();
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM samples
       WHERE survey_date = ? AND farm_name = ? AND label = ? AND treatment = ? AND tree_no = ? AND fruit_no = ?`,
      session.surveyDate,
      session.farmName,
      session.label,
      session.treatment,
      session.treeNo,
      session.fruitNo
    );
    const now = formatTimestamp();

    if (existing) {
      await db.runAsync(
        `UPDATE samples
         SET observer = ?, survey_type = ?, updated_at = ?, sync_status = 0
         WHERE id = ?`,
        session.observer,
        session.surveyType,
        now,
        existing.id
      );
      return existing.id;
    }

    const id = uuidv4();
    await db.runAsync(
      `INSERT INTO samples (
        id, survey_date, observer, farm_name, label, treatment, survey_type, tree_no, fruit_no,
        sync_status, created_at, updated_at, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
      id,
      session.surveyDate,
      session.observer,
      session.farmName,
      session.label,
      session.treatment,
      session.surveyType,
      session.treeNo,
      session.fruitNo,
      now,
      now
    );
    return id;
  }

  async saveParsedIntent(intent: ParsedIntent, session: SessionContext, ranges: ValueRange[]) {
    if (intent.kind !== 'measurement' && intent.kind !== 'text') {
      return null;
    }

    const db = await this.getDatabase();
    const sampleId = await this.ensureSample(session);
    const now = formatTimestamp();

    await db.withExclusiveTransactionAsync(async (txn) => {
      const itemName = intent.kind === 'measurement' ? intent.itemName : intent.fieldName;
      const previous = await txn.getFirstAsync<{
        numeric_value: number | null;
        text_value: string | null;
      }>(
        'SELECT numeric_value, text_value FROM measurements WHERE sample_id = ? AND item_name = ?',
        sampleId,
        itemName
      );

      await txn.runAsync(
        `INSERT INTO undo_stack (
          id, sample_id, item_name, previous_numeric_value, previous_text_value, raw_voice_text, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        uuidv4(),
        sampleId,
        itemName,
        previous?.numeric_value ?? null,
        previous?.text_value ?? null,
        intent.rawText,
        now
      );

      const rangeStatus =
        intent.kind === 'measurement'
          ? getRangeStatus(intent.itemName, intent.value, ranges)
          : { isOutOfRange: false };

      await txn.runAsync(
        `INSERT INTO measurements (
          id, sample_id, item_name, item_type, numeric_value, text_value, raw_voice_text, is_out_of_range, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(sample_id, item_name) DO UPDATE SET
          item_type = excluded.item_type,
          numeric_value = excluded.numeric_value,
          text_value = excluded.text_value,
          raw_voice_text = excluded.raw_voice_text,
          is_out_of_range = excluded.is_out_of_range,
          updated_at = excluded.updated_at`,
        uuidv4(),
        sampleId,
        itemName,
        intent.kind === 'measurement' ? 'measurement' : 'text',
        intent.kind === 'measurement' ? intent.value : null,
        intent.kind === 'text' ? intent.value : null,
        intent.rawText,
        rangeStatus.isOutOfRange ? 1 : 0,
        now
      );

      await txn.runAsync(
        'UPDATE samples SET updated_at = ?, sync_status = 0 WHERE id = ?',
        now,
        sampleId
      );

      const overflow = await txn.getAllAsync<{ id: string }>(
        'SELECT id FROM undo_stack ORDER BY created_at DESC LIMIT -1 OFFSET 20'
      );
      for (const row of overflow) {
        await txn.runAsync('DELETE FROM undo_stack WHERE id = ?', row.id);
      }
    });

    return sampleId;
  }

  async undoLatest() {
    const db = await this.getDatabase();
    const latest = await db.getFirstAsync<{
      id: string;
      sample_id: string;
      item_name: string;
      previous_numeric_value: number | null;
      previous_text_value: string | null;
    }>(
      `SELECT id, sample_id, item_name, previous_numeric_value, previous_text_value
       FROM undo_stack
       ORDER BY created_at DESC
       LIMIT 1`
    );

    if (!latest) {
      return false;
    }

    const now = formatTimestamp();
    const restore = resolveUndoValue(latest.previous_numeric_value, latest.previous_text_value);

    await db.withExclusiveTransactionAsync(async (txn) => {
      if (restore.deleteCurrent) {
        await txn.runAsync(
          'DELETE FROM measurements WHERE sample_id = ? AND item_name = ?',
          latest.sample_id,
          latest.item_name
        );
      } else {
        await txn.runAsync(
          `UPDATE measurements
           SET numeric_value = ?, text_value = ?, updated_at = ?
           WHERE sample_id = ? AND item_name = ?`,
          restore.numericValue,
          restore.textValue,
          now,
          latest.sample_id,
          latest.item_name
        );
      }

      await txn.runAsync('DELETE FROM undo_stack WHERE id = ?', latest.id);
      await txn.runAsync(
        'UPDATE samples SET updated_at = ?, sync_status = 0 WHERE id = ?',
        now,
        latest.sample_id
      );
    });

    return true;
  }

  async listRecentVoiceLogs(limit = 8): Promise<string[]> {
    const db = await this.getDatabase();
    const rows = await db.getAllAsync<{ raw_voice_text: string }>(
      `SELECT raw_voice_text FROM measurements
       WHERE raw_voice_text <> ''
       ORDER BY updated_at DESC
       LIMIT ?`,
      limit
    );
    return rows.map((row) => row.raw_voice_text);
  }

  async getTodayMeasurements(session: SessionContext): Promise<MeasurementRecord[]> {
    const db = await this.getDatabase();
    const sample = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM samples
       WHERE survey_date = ? AND farm_name = ? AND label = ? AND treatment = ? AND tree_no = ? AND fruit_no = ?`,
      session.surveyDate,
      session.farmName,
      session.label,
      session.treatment,
      session.treeNo,
      session.fruitNo
    );
    if (!sample) {
      return [];
    }

    const rows = await db.getAllAsync<{
      item_name: string;
      item_type: 'measurement' | 'text';
      numeric_value: number | null;
      text_value: string | null;
      raw_voice_text: string;
      is_out_of_range: number;
      updated_at: string;
    }>(
      `SELECT item_name, item_type, numeric_value, text_value, raw_voice_text, is_out_of_range, updated_at
       FROM measurements
       WHERE sample_id = ?`,
      sample.id
    );

    return rows.map((row) => ({
      itemName: row.item_name as MeasurementItemName,
      itemType: row.item_type,
      numericValue: row.numeric_value,
      textValue: row.text_value,
      rawVoiceText: row.raw_voice_text,
      isOutOfRange: row.is_out_of_range === 1,
      updatedAt: row.updated_at,
    }));
  }

  async saveHistoryCache(rows: HistoryCacheRow[]) {
    const db = await this.getDatabase();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('DELETE FROM history_cache');
      for (const row of rows) {
        await txn.runAsync(
          `INSERT INTO history_cache (
            id, survey_date, farm_name, label, treatment, tree_no, fruit_no, item_name, value, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          uuidv4(),
          row.surveyDate,
          row.farmName,
          row.label,
          row.treatment,
          row.treeNo,
          row.fruitNo,
          row.itemName,
          row.value,
          formatTimestamp()
        );
      }
    });
  }

  async getComparisonRows(session: SessionContext, enabledItems: MeasurementItemName[]) {
    const today = await this.getTodayMeasurements(session);
    const db = await this.getDatabase();
    const history = await db.getAllAsync<{
      item_name: MeasurementItemName;
      value: number;
    }>(
      `SELECT item_name, value FROM history_cache
       WHERE farm_name = ? AND label = ? AND treatment = ? AND tree_no = ? AND fruit_no = ?`,
      session.farmName,
      session.label,
      session.treatment,
      session.treeNo,
      session.fruitNo
    );

    return enabledItems.map<ComparisonRow>((itemName) => {
      const todayRow = today.find((entry) => entry.itemName === itemName);
      const historyRow = history.find((entry) => entry.item_name === itemName);
      const delta = getDeltaSeverity(todayRow?.numericValue ?? null, historyRow?.value ?? null);
      return {
        itemName,
        todayValue: todayRow?.numericValue ?? null,
        historyValue: historyRow?.value ?? null,
        deltaPercent: delta.deltaPercent,
        severity: delta.severity,
        isOutOfRange: todayRow?.isOutOfRange ?? false,
      };
    });
  }

  async listRecentSamples(limit = 30): Promise<SurveyRecordListItem[]> {
    const db = await this.getDatabase();
    return db.getAllAsync<SurveyRecordListItem>(
      `SELECT id, survey_date as surveyDate, farm_name as farmName, label, treatment, survey_type as surveyType,
        tree_no as treeNo, fruit_no as fruitNo, sync_status as syncStatus, updated_at as updatedAt
       FROM samples
       ORDER BY updated_at DESC
       LIMIT ?`,
      limit
    );
  }

  async getProgressSummary(): Promise<ProgressSummary> {
    const db = await this.getDatabase();
    const row = await db.getFirstAsync<{
      totalSamples: number;
      pendingSamples: number;
      syncedSamples: number;
      lastSyncedAt: string | null;
    }>(
      `SELECT
        COUNT(*) as totalSamples,
        SUM(CASE WHEN sync_status = 0 THEN 1 ELSE 0 END) as pendingSamples,
        SUM(CASE WHEN sync_status = 1 THEN 1 ELSE 0 END) as syncedSamples,
        MAX(last_synced_at) as lastSyncedAt
       FROM samples`
    );

    return {
      totalSamples: row?.totalSamples ?? 0,
      pendingSamples: row?.pendingSamples ?? 0,
      syncedSamples: row?.syncedSamples ?? 0,
      lastSyncedAt: row?.lastSyncedAt ?? null,
    };
  }

  async getPendingSyncRows(): Promise<SyncPayloadRow[]> {
    const db = await this.getDatabase();
    const sampleRows = await db.getAllAsync<{
      id: string;
      surveyDate: string;
      farmName: string;
      label: string;
      treatment: string;
      treeNo: number;
      fruitNo: number;
      observer: string;
      surveyType: '비대조사' | '품질조사' | '추가조사';
    }>(
      `SELECT
        id, survey_date as surveyDate, farm_name as farmName, label, treatment,
        tree_no as treeNo, fruit_no as fruitNo, observer, survey_type as surveyType
       FROM samples
       WHERE sync_status = 0
       ORDER BY updated_at ASC`
    );

    const result: SyncPayloadRow[] = [];
    for (const sample of sampleRows) {
      const measurements = await db.getAllAsync<{
        item_name: string;
        numeric_value: number | null;
        text_value: string | null;
      }>(
        'SELECT item_name, numeric_value, text_value FROM measurements WHERE sample_id = ?',
        sample.id
      );

      const payload: Record<string, string | number | null> = {
      };
      for (const measurement of measurements) {
        payload[measurement.item_name] = measurement.numeric_value ?? measurement.text_value;
      }
      const memo = typeof payload.비고 === 'string' ? payload.비고 : '';
      delete payload.비고;

      result.push({
        sampleId: sample.id,
        surveyType: sample.surveyType,
        row: {
          surveyDate: sample.surveyDate,
          surveyType: sample.surveyType,
          farmName: sample.farmName,
          label: sample.label,
          treatment: sample.treatment,
          treeNo: sample.treeNo,
          fruitNo: sample.fruitNo,
          measurements: Object.entries(payload).reduce<Record<string, string | number>>(
            (accumulator, [key, value]) => {
              if (typeof value === 'string' || typeof value === 'number') {
                accumulator[key] = value;
              }
              return accumulator;
            },
            {}
          ),
          memo,
          observer: sample.observer,
        },
      });
    }

    return result;
  }

  async markSamplesSynced(sampleIds: string[]) {
    if (sampleIds.length === 0) {
      return;
    }
    const db = await this.getDatabase();
    const now = formatTimestamp();
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const sampleId of sampleIds) {
        await txn.runAsync(
          'UPDATE samples SET sync_status = 1, last_synced_at = ?, updated_at = ? WHERE id = ?',
          now,
          now,
          sampleId
        );
      }
    });
  }

  async resetAllData() {
    const db = await this.getDatabase();
    await db.execAsync(`
      DELETE FROM undo_stack;
      DELETE FROM measurements;
      DELETE FROM samples;
      DELETE FROM history_cache;
      DELETE FROM custom_terms;
    `);
    await this.seedDefaults();
  }
}

export const databaseService = new DatabaseService();
