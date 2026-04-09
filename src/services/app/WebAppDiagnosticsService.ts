import { GOOGLE_SHEETS_ID } from '../../constants/app';
import { parseSyncHttpResponse } from '../sync/syncParsers';

type DiagnosticResult = {
  ok: boolean;
  message: string;
  details?: string;
};

async function readTextSafely(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

class WebAppDiagnosticsService {
  async testHistoryGet(webAppUrl: string, year: number, farm: string): Promise<DiagnosticResult> {
    const params = new URLSearchParams({
      year: String(year),
      farm,
    });
    const response = await fetch(`${webAppUrl}?${params.toString()}`);
    const text = await readTextSafely(response);

    if (!response.ok) {
      return {
        ok: false,
        message: `GET 복구 테스트 실패: ${response.status}`,
        details: text.slice(0, 200),
      };
    }

    try {
      const parsed = JSON.parse(text) as {
        status?: string;
        data?: Record<string, unknown[]>;
      };
      const groups = Object.keys(parsed.data ?? {});
      return {
        ok: parsed.status === 'ok',
        message:
          parsed.status === 'ok'
            ? `GET 복구 테스트 성공: ${groups.join(', ')}`
            : 'GET 응답 형식이 예상과 다릅니다.',
        details: text.slice(0, 300),
      };
    } catch {
      return {
        ok: false,
        message: 'GET 응답이 JSON이 아닙니다.',
        details: text.slice(0, 200),
      };
    }
  }

  async testSyncPost(webAppUrl: string): Promise<DiagnosticResult> {
    const attempts: DiagnosticResult[] = [];
    const payload = {
      action: 'upsertSamples',
      sheetId: GOOGLE_SHEETS_ID,
      rows: [],
    };

    const jsonResponse = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const jsonText = await readTextSafely(jsonResponse);
    const jsonParsed = parseSyncHttpResponse(
      jsonResponse.status,
      jsonResponse.headers.get('content-type') ?? '',
      jsonText
    );
    attempts.push({
      ok: jsonParsed.ok,
      message: `[json] ${jsonParsed.message}`,
      details: jsonParsed.details,
    });

    const formBody = new URLSearchParams({
      action: 'upsertSamples',
      sheetId: GOOGLE_SHEETS_ID,
      rows: '[]',
    });
    const formResponse = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });
    const formText = await readTextSafely(formResponse);
    const formParsed = parseSyncHttpResponse(
      formResponse.status,
      formResponse.headers.get('content-type') ?? '',
      formText
    );
    attempts.push({
      ok: formParsed.ok,
      message: `[form] ${formParsed.message}`,
      details: formParsed.details,
    });

    const success = attempts.find((entry) => entry.ok);
    if (success) {
      return success;
    }

    return {
      ok: false,
      message: attempts.map((entry) => entry.message).join(' | '),
      details: attempts.map((entry) => entry.details ?? '').join('\n'),
    };
  }
}

export const webAppDiagnosticsService = new WebAppDiagnosticsService();
