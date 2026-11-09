export const MODEL = 'gpt-5.4-mini'
export const ENDPOINT = 'https://api.openai.com/v1/responses'

function httpError(status, code) {
  if (status === 401) return 'API 키가 올바르지 않거나 만료되었습니다. .env.local의 키를 확인한 뒤 개발 서버를 재시작해 주세요.'
  if (status === 403) return 'API 접근 권한이 없습니다. 프로젝트 권한과 지원 지역을 확인해 주세요.'
  if (status === 404) return '모델을 사용할 수 없습니다. 프로젝트의 gpt-5.4-mini 접근 권한을 확인해 주세요.'
  if (status === 429 && code === 'insufficient_quota') return 'API 크레딧 또는 사용 한도가 부족합니다. OpenAI 결제 및 프로젝트 한도를 확인해 주세요.'
  if (status === 429) return '요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.'
  if (status >= 500) return 'OpenAI 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.'
  if (status === 400) return '요청을 처리할 수 없습니다. 대화가 너무 길다면 대화를 초기화해 주세요.'
  return `API 요청이 실패했습니다 (HTTP ${status}). 설정을 확인한 뒤 다시 시도해 주세요.`
}

// SDK의 output_text 편의 속성 대신 실제 REST 응답의 output 배열을 읽습니다.
export function extractReply(data) {
  if (data.status !== 'completed') {
    if (data.status === 'incomplete') throw new Error('응답 생성이 완료되지 않았습니다. 질문을 짧게 작성해 다시 시도해 주세요.')
    throw new Error('API가 답변 생성을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
  const messages = (data.output ?? []).filter(item => item.type === 'message' && item.role === 'assistant')
  const parts = messages.flatMap(item => item.content ?? [])
  const answer = parts.filter(part => part.type === 'output_text').map(part => part.text).join('\n').trim()
  if (answer) return answer
  const refusal = parts.filter(part => part.type === 'refusal').map(part => part.refusal).join('\n').trim()
  if (refusal) return refusal
  throw new Error('요청은 처리되었지만 표시할 답변이 없습니다. 질문을 바꾸어 다시 시도해 주세요.')
}

export async function createResponse(apiKey, input, { signal } = {}) {
  if (!apiKey?.trim()) throw new Error('키가 설정되지 않았습니다. .env.local에 API 키를 입력하고 개발 서버를 재시작해 주세요.')
  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        instructions: '도움을 주는 챗봇입니다. 사용자의 언어로 명확하고 간결하게 답하세요.',
        input,
        store: false,
        max_output_tokens: 4096,
      }),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('네트워크 요청에 실패했습니다. 인터넷 연결, 브라우저의 요청 차단 및 CORS 오류를 확인해 주세요.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(httpError(response.status, data?.error?.code))
  if (!data) throw new Error('API 응답을 읽을 수 없습니다. 잠시 후 다시 시도해 주세요.')
  return extractReply(data)
}
