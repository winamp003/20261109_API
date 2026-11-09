import './style.css'
import { createResponse, MODEL } from './api.js'

const apiKey = (import.meta.env.VITE_OPENAI_API_KEY ?? '').trim()
let history = []
let pending = false
let controller = null

document.querySelector('#app').innerHTML = `
  <div class="workspace">
    <aside class="sidebar">
      <a class="brand" href="./" aria-label="Responses Lab 홈"><span class="brand-mark" aria-hidden="true">✳</span> responses<span class="brand-light">lab</span></a>
      <span class="eyebrow">OPENAI API PLAYGROUND</span>
      <button id="reset" class="new-chat" type="button"><span aria-hidden="true">＋</span> 대화 초기화</button>
      <div class="session-note"><span class="small-dot"></span> 새로운 대화<span class="session-sub">현재 탭에서만 기록됩니다</span></div>
      <div class="sidebar-bottom">
        <div class="model-card"><span class="eyebrow">MODEL</span><strong>${MODEL}</strong><span>Responses API · 텍스트 대화</span></div>
        <a href="https://developers.openai.com/api/docs/guides/text" target="_blank" rel="noopener noreferrer">공식 문서 <span aria-hidden="true">↗</span></a>
        <span class="version">VANILLA JS + VITE / LEARNING PROJECT</span>
      </div>
    </aside>
    <main>
      <header class="topbar"><div><span class="header-title">챗봇 실습</span><span class="header-divider">/</span><span class="header-sub">Responses API</span></div><span id="api-status" class="status" role="status"></span></header>
      <section class="chat-area" aria-label="챗봇 대화">
        <div id="welcome" class="welcome">
          <div class="welcome-mark" aria-hidden="true">✳</div>
          <span class="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</span>
          <h1>어떤 이야기를 나눠볼까요?</h1>
          <p>궁금한 것을 물어보세요.<br>이전 대화를 기억하며 함께 이야기합니다.</p>
          <div class="suggestions">
            <button type="button" data-prompt="Responses API의 요청과 응답 구조를 간단한 예시로 설명해 줘."><span>개념 이해하기</span>Responses API는 어떻게 동작하나요? <b aria-hidden="true">↗</b></button>
            <button type="button" data-prompt="JavaScript의 async와 await를 초보자도 이해하기 쉽게 설명해 줘."><span>코드 배우기</span>async / await를 쉽게 설명해 주세요. <b aria-hidden="true">↗</b></button>
          </div>
        </div>
        <div id="messages" class="messages" role="log" aria-label="대화 내용" aria-live="polite" aria-relevant="additions text"></div>
      </section>
      <div class="composer-area">
        <p id="setup-note" class="setup-note"></p>
        <p id="error" class="error" role="alert" hidden></p>
        <form id="chat-form" class="composer">
          <label class="sr-only" for="message">메시지</label>
          <textarea id="message" rows="2" maxlength="12000" placeholder="메시지를 입력하세요…" aria-describedby="input-hint"></textarea>
          <div class="composer-bottom"><span id="input-hint">Enter로 전송 · Shift + Enter로 줄바꿈</span><button id="send" type="submit" aria-label="메시지 전송">↑</button></div>
        </form>
        <p class="security-note">교육용 로컬 실습 · 브라우저 환경 변수는 API 키를 숨기지 못합니다.<br class="mobile-break"> 실제 키가 포함된 앱과 빌드 결과물을 공개 배포하지 마세요.</p>
      </div>
    </main>
  </div>
`

const form = document.querySelector('#chat-form')
const input = document.querySelector('#message')
const send = document.querySelector('#send')
const messages = document.querySelector('#messages')
const welcome = document.querySelector('#welcome')
const errorBox = document.querySelector('#error')
const status = document.querySelector('#api-status')
const area = document.querySelector('.chat-area')

function setStatus(text) {
  status.textContent = text
  status.dataset.state = text === '요청 성공' ? 'success' : 'idle'
}
setStatus(apiKey ? '연결 미확인' : '키 미설정')
document.querySelector('#setup-note').textContent = apiKey
  ? '실제 메시지 요청에 성공하면 API 상태가 ‘요청 성공’으로 바뀝니다.'
  : '시작하기: .env.local의 VITE_OPENAI_API_KEY에 키를 입력한 뒤 개발 서버를 재시작하세요.'

function updateControls() {
  send.disabled = pending || !apiKey || !input.value.trim()
  input.disabled = pending
  form.setAttribute('aria-busy', String(pending))
}
function scrollToEnd() { area.scrollTop = area.scrollHeight }
function appendMessage(role, text, loading = false) {
  const article = document.createElement('article')
  article.className = `message ${role}`
  const label = document.createElement('div')
  label.className = 'message-label'
  label.textContent = role === 'user' ? '나' : 'ASSISTANT'
  const body = document.createElement('div')
  body.className = loading ? 'message-body loading' : 'message-body'
  // 사용자 입력과 모델 출력은 HTML로 해석하지 않습니다.
  body.textContent = text
  article.append(label, body)
  messages.append(article)
  scrollToEnd()
  return article
}

input.addEventListener('input', updateControls)
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault()
    if (!send.disabled) form.requestSubmit()
  }
})
document.querySelectorAll('[data-prompt]').forEach(button => {
  button.addEventListener('click', () => {
    if (pending) return
    input.value = button.dataset.prompt
    updateControls()
    input.focus()
  })
})

form.addEventListener('submit', async event => {
  event.preventDefault()
  const text = input.value.trim()
  if (pending || !text || !apiKey) return
  pending = true
  controller = new AbortController()
  const activeController = controller
  const timeout = setTimeout(() => activeController.abort(), 90000)
  errorBox.hidden = true
  welcome.hidden = true
  appendMessage('user', text)
  const loading = appendMessage('assistant', '답변을 작성하고 있습니다…', true)
  input.value = ''
  updateControls()
  setStatus('요청 중')
  // 성공한 이전 대화와 이번 질문을 매 요청에 함께 보냅니다.
  const nextHistory = [...history, { role: 'user', content: text }]
  try {
    const reply = await createResponse(apiKey, nextHistory, { signal: activeController.signal })
    if (controller !== activeController) return
    loading.remove()
    appendMessage('assistant', reply)
    history = [...nextHistory, { role: 'assistant', content: reply }]
    setStatus('요청 성공')
  } catch (error) {
    if (controller !== activeController) return
    loading.remove()
    setStatus('요청 실패')
    errorBox.textContent = error.name === 'AbortError'
      ? '응답 대기 시간(90초)을 초과했습니다. 잠시 후 다시 시도해 주세요.'
      : error.message
    errorBox.hidden = false
    input.value = text
    scrollToEnd()
  } finally {
    clearTimeout(timeout)
    if (controller === activeController) {
      pending = false
      controller = null
      updateControls()
      input.focus()
    }
  }
})

document.querySelector('#reset').addEventListener('click', () => {
  controller?.abort()
  controller = null
  pending = false
  history = []
  messages.replaceChildren()
  welcome.hidden = false
  errorBox.hidden = true
  errorBox.textContent = ''
  input.value = ''
  // 초기화 후 새 대화의 첫 실제 요청 전에는 성공으로 표시하지 않습니다.
  setStatus(apiKey ? '연결 미확인' : '키 미설정')
  updateControls()
  input.focus()
})
updateControls()
