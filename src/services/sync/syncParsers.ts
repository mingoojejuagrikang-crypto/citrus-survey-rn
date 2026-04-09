export type ParsedSyncResponse =
  | {
      ok: true;
      message: string;
      details: string;
    }
  | {
      ok: false;
      message: string;
      details: string;
    };

export function parseSyncHttpResponse(
  status: number,
  contentType: string,
  rawText: string
): ParsedSyncResponse {
  if (status < 200 || status >= 300) {
    return {
      ok: false,
      message: `동기화 실패: ${status}`,
      details: rawText.slice(0, 200),
    };
  }

  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      message: '동기화 웹앱이 JSON을 반환하지 않습니다. doPost 배포 상태를 확인하세요.',
      details: rawText.slice(0, 200),
    };
  }

  try {
    const payload = JSON.parse(rawText) as { success?: boolean; status?: string; message?: string };
    if (payload.success === false || payload.status === 'error') {
      return {
        ok: false,
        message: payload.message ?? '서버가 동기화를 거부했습니다.',
        details: rawText.slice(0, 200),
      };
    }

    return {
      ok: true,
      message: payload.message ?? '동기화 성공',
      details: rawText.slice(0, 200),
    };
  } catch {
    return {
      ok: false,
      message: '동기화 응답 JSON 파싱 실패',
      details: rawText.slice(0, 200),
    };
  }
}
