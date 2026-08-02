import 'server-only';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

type OpenAIOutputContent = {
  type?: string;
  text?: string;
  refusal?: string;
};

type OpenAIOutputItem = {
  type?: string;
  content?: OpenAIOutputContent[];
};

export type OpenAIResponse = {
  id?: string;
  status?: string;
  output?: OpenAIOutputItem[];
  error?: {
    code?: string;
    message?: string;
    type?: string;
  } | null;
  incomplete_details?: {
    reason?: string;
  } | null;
};

export class OpenAIRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly requestId?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'OpenAIRequestError';
  }
}

/**
 * OpenAI Responses API'ye sunucu tarafında istek gönderir.
 * API anahtarı hiçbir zaman istemciye veya hata mesajına dahil edilmez.
 */
export async function createOpenAIResponse(
  body: Record<string, unknown>,
  options?: { timeoutMs?: number }
): Promise<OpenAIResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new OpenAIRequestError('OpenAI API yapılandırılmamış: OPENAI_API_KEY eksik.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 120_000);

  let response: Response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...body, store: false }),
      signal: controller.signal,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'OpenAI isteği zaman aşımına uğradı.'
        : 'OpenAI servisine ulaşılamadı.';
    throw new OpenAIRequestError(message, undefined, undefined, undefined, error);
  } finally {
    clearTimeout(timeout);
  }

  const requestId = response.headers.get('x-request-id') ?? undefined;
  let payload: OpenAIResponse;
  try {
    payload = (await response.json()) as OpenAIResponse;
  } catch (error) {
    throw new OpenAIRequestError(
      `OpenAI geçersiz bir yanıt verdi (${response.status}).`,
      response.status,
      undefined,
      requestId,
      error
    );
  }

  if (!response.ok || payload.error) {
    throw new OpenAIRequestError(
      payload.error?.message ?? `OpenAI isteği başarısız oldu (${response.status}).`,
      response.status,
      payload.error?.code ?? payload.error?.type,
      requestId
    );
  }

  if (payload.status === 'failed') {
    throw new OpenAIRequestError('OpenAI yanıt üretimini tamamlayamadı.', response.status, undefined, requestId);
  }

  if (payload.status === 'incomplete') {
    throw new OpenAIRequestError(
      `OpenAI yanıtı tamamlanamadı${payload.incomplete_details?.reason ? `: ${payload.incomplete_details.reason}` : '.'}`,
      response.status,
      payload.incomplete_details?.reason,
      requestId
    );
  }

  return payload;
}

/** Responses API yanıtındaki tüm output_text parçalarını birleştirir. */
export function getOpenAIOutputText(response: OpenAIResponse): string {
  return (
    response.output
      ?.filter((item) => item.type === 'message')
      .flatMap((item) => item.content ?? [])
      .filter((content) => content.type === 'output_text')
      .map((content) => content.text ?? '')
      .join('')
      .trim() ?? ''
  );
}
