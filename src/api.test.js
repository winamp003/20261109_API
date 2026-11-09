import test from 'node:test'
import assert from 'node:assert/strict'
import { createResponse, extractReply, ENDPOINT, MODEL } from './api.js'

const completed = (...parts) => ({
  status: 'completed',
  output: [{ type: 'reasoning' }, { type: 'message', role: 'assistant', content: parts }],
})
test('reads all output_text parts instead of assuming output[0] is a message', () => {
  assert.equal(extractReply(completed({ type: 'output_text', text: '첫째' }, { type: 'output_text', text: '둘째' })), '첫째\n둘째')
})
test('displays refusal; rejects incomplete and empty responses', () => {
  assert.equal(extractReply(completed({ type: 'refusal', refusal: '도와드릴 수 없습니다.' })), '도와드릴 수 없습니다.')
  assert.throws(() => extractReply({ status: 'incomplete' }), /완료되지/)
  assert.throws(() => extractReply(completed()), /표시할 답변/)
})
test('sends current conversation to Responses API with bearer authorization', async t => {
  const input = [{ role: 'user', content: '내 이름은 민수야' }, { role: 'assistant', content: '반가워요.' }, { role: 'user', content: '내 이름은?' }]
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, ENDPOINT)
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer test-only')
    const body = JSON.parse(options.body)
    assert.equal(body.model, MODEL)
    assert.deepEqual(body.input, input)
    assert.equal(body.store, false)
    return Response.json(completed({ type: 'output_text', text: '민수입니다.' }))
  })
  assert.equal(await createResponse('test-only', input), '민수입니다.')
})
test('missing key makes no network request', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('must not call') })
  await assert.rejects(createResponse('', []), /키가 설정되지/)
  assert.equal(fetch.mock.callCount(), 0)
})
test('explains authentication, quota, rate limits and server errors', async t => {
  for (const [status, code, expected] of [
    [401, null, /키가 올바르지/], [429, 'insufficient_quota', /크레딧/],
    [429, 'rate_limit_exceeded', /요청 한도/], [503, null, /서버/],
  ]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { code } }, { status }))
    await assert.rejects(createResponse('test-only', []), expected)
    mock.mock.restore()
  }
})
test('explains invalid JSON and network errors without showing credentials', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('invalid'))
  await assert.rejects(createResponse('test-only', []), /응답을 읽을 수/)
  mock.mock.restore()
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch') })
  await assert.rejects(createResponse('test-only', []), /네트워크 요청/)
})
test('preserves abort errors for timeout and reset handling', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('Aborted', 'AbortError') })
  await assert.rejects(createResponse('test-only', []), { name: 'AbortError' })
})
