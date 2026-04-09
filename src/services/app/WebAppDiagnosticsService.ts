import { GOOGLE_SHEETS_ID } from '../../constants/app';

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
    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'upsertSamples',
        sheetId: GOOGLE_SHEETS_ID,
        rows: [],
      }),
    });

    const text = await readTextSafely(response);
    const contentType = response.headers.get('content-type') ?? '';

    if (!response.ok) {
      return {
        ok: false,
        message: `POST 동기화 테스트 실패: ${response.status}`,
        details: text.slice(0, 200),
      };
    }

    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        message: 'POST 응답이 JSON이 아닙니다. 웹앱 배포 또는 doPost 구현 확인이 필요합니다.',
        details: text.slice(0, 200),
      };
    }

    try {
      const parsed = JSON.parse(text) as { success?: boolean; status?: string; message?: string };
      if (parsed.success === false || parsed.status === 'error') {
        return {
          ok: false,
          message: parsed.message ?? 'POST 동기화 테스트 실패',
          details: text.slice(0, 200),
        };
      }
      return {
        ok: true,
        message: 'POST 동기화 테스트 성공',
        details: text.slice(0, 200),
      };
    } catch {
      return {
        ok: false,
        message: 'POST 응답 JSON 파싱 실패',
        details: text.slice(0, 200),
      };
    }
  }
}

export const webAppDiagnosticsService = new WebAppDiagnosticsService();
