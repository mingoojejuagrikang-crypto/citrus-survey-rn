/**
 * 취소(Undo) 스택 — 최대 20건
 * DB의 undo_stack 테이블 사용
 */
import { getDB } from './DatabaseService';
import 'react-native-get-random-values';

export interface UndoEntry {
  sampleId: string;
  itemName: string;
  previousValue: number | null;
  actionType: 'set' | 'delete';
}

const MAX_UNDO = 20;

export async function pushUndo(entry: UndoEntry): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO undo_stack (sample_id, item_name, previous_value, action_type)
     VALUES (?, ?, ?, ?)`,
    [entry.sampleId, entry.itemName, entry.previousValue, entry.actionType]
  );
  // 20건 초과 시 가장 오래된 것 삭제
  await db.runAsync(
    `DELETE FROM undo_stack WHERE undo_id IN (
       SELECT undo_id FROM undo_stack ORDER BY undo_id ASC
       LIMIT MAX(0, (SELECT COUNT(*) FROM undo_stack) - ?)
     )`,
    [MAX_UNDO]
  );
}

export async function popUndo(): Promise<UndoEntry | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{
    undo_id: number; sample_id: string; item_name: string;
    previous_value: number | null; action_type: string;
  }>(
    'SELECT * FROM undo_stack ORDER BY undo_id DESC LIMIT 1'
  );
  if (!row) return null;
  await db.runAsync('DELETE FROM undo_stack WHERE undo_id = ?', [row.undo_id]);
  return {
    sampleId: row.sample_id,
    itemName: row.item_name,
    previousValue: row.previous_value,
    actionType: row.action_type as 'set' | 'delete',
  };
}

export async function clearUndo(): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM undo_stack');
}
