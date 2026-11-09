# Responses Lab

Vanilla JavaScript + Vite 기반 교육용 챗봇입니다. 별도 백엔드나 Netlify 함수 없이 브라우저의 fetch로 OpenAI Responses API를 직접 호출합니다.

## API 키와 실행

1. 프로젝트 루트의 `.env.local`을 열고 빈 값에 본인의 API 키를 입력합니다.

   ```dotenv
   VITE_OPENAI_API_KEY=여기에_본인의_API_키_입력
   ```

   실제 키는 이 문서나 소스 코드에 입력하지 마세요. `.env.example`은 키 없는 작성 예시입니다.
2. 프로젝트 폴더의 터미널에서 실행합니다.

   ```sh
   npm install
   npm run dev
   ```

   PowerShell 실행 정책으로 npm.ps1이 차단되면 `npm.cmd install`, `npm.cmd run dev`를 사용합니다.
3. 터미널에 표시되는 로컬 주소를 브라우저에서 엽니다.
4. 환경 변수를 수정했다면 개발 서버 터미널에서 **Ctrl+C**로 종료하고 **npm run dev** (또는 **npm.cmd run dev**)로 다시 시작한 뒤 브라우저를 새로고침합니다.

## 사용

- 메시지를 입력하고 전송 버튼 또는 Enter를 누릅니다. Shift+Enter는 줄바꿈입니다.
- 요청 중에는 중복 전송을 막고 로딩 문구를 표시합니다.
- 성공한 사용자/assistant 대화를 메모리에 보관하고 다음 요청의 input에 함께 보냅니다. 실패한 질문은 입력란에 복원하며 다음 요청 기록에는 추가하지 않습니다.
- 대화 초기화는 진행 중 요청을 취소하고 대화 기록과 오류를 지웁니다.
- 새로고침하면 기록이 사라집니다. 별도 저장소에 키나 대화를 저장하지 않습니다.
- 상태: **키 미설정 → 연결 미확인 → 요청 중 → 요청 성공 / 요청 실패**. 키 존재만으로 성공을 표시하지 않습니다.
- 인증, 권한, 모델 접근, 크레딧 부족, 요청 제한, 서버·네트워크 오류를 구분해 안내합니다. 90초가 지나면 요청 대기를 종료합니다.

## 요청·응답 구조

모델: **gpt-5.4-mini**. 공식 모델 문서에서 Responses API와 텍스트 입출력 지원을 확인했습니다(2026-11-09). 계정·프로젝트의 모델 접근 권한과 API 결제 상태에 따라 사용 가능 여부가 달라질 수 있습니다.

`src/api.js`에서 다음 REST 요청을 보냅니다. 키는 `src/main.js`의 `import.meta.env.VITE_OPENAI_API_KEY`로 읽습니다.

```http
POST https://api.openai.com/v1/responses
Authorization: Bearer <환경 변수에서 읽은 키>
Content-Type: application/json
```

```json
{
  "model": "gpt-5.4-mini",
  "instructions": "도움을 주는 챗봇입니다. 사용자의 언어로 명확하고 간결하게 답하세요.",
  "input": [
    { "role": "user", "content": "안녕하세요." },
    { "role": "assistant", "content": "안녕하세요! 무엇을 도와드릴까요?" },
    { "role": "user", "content": "방금 내가 한 말을 알려줘." }
  ],
  "store": false,
  "max_output_tokens": 4096
}
```

응답의 `status`가 `completed`인지 확인하고 `output` 배열 안의 assistant `message.content`에서 `type: "output_text"`인 항목들의 `text`를 모아 표시합니다. SDK의 `response.output_text` 편의 속성이나 Chat Completions의 `choices` 형식을 사용하지 않습니다. 거절 응답과 불완전한 응답도 처리합니다. 대화가 이어질수록 이전 기록도 다시 전송하므로 입력 토큰 사용량이 증가합니다. 긴 대화는 초기화해 주세요.

## 검증

```sh
node --test
npm run build
```

빌드는 `dist/`를 생성합니다. 실제 키가 없는 상태에서도 빌드는 가능합니다. 실제 API 성공 여부는 본인의 키를 입력하고 메시지를 전송해야 확인할 수 있습니다. 자동 테스트는 가짜 fetch로 요청 형식, 대화 기록 전송, 응답 파싱과 오류 처리를 검증하며 실제 API 요금은 발생시키지 않습니다.

## 키와 배포 주의

**Vite의 VITE_ 환경 변수는 브라우저 코드에 포함됩니다. .env.local이나 .gitignore는 브라우저에서 API 키를 숨겨 주지 못합니다.** 개발자 도구와 요청 헤더, 빌드된 JavaScript에서 키를 확인할 수 있습니다.

**실제 키가 포함된 앱이나 dist 결과물을 GitHub에 업로드하거나 공개 배포하지 마세요.** 이 프로젝트는 로컬 교육 실습 전용입니다. 실제 서비스에서는 서버에서 키를 보관하는 구조를 사용해야 합니다. 키가 노출되면 폐기하고 재발급하세요.

.gitignore는 .env와 .env.*를 제외하고, 키 없는 .env.example만 포함하도록 설정합니다. 이 폴더는 작업 시작 시 Git 저장소가 아니므로 이미 추적된 파일은 없었습니다. 추후 Git 저장소에 편입할 경우 기존에 추적된 비밀 파일은 별도로 추적 해제해야 합니다.

## 참고한 OpenAI 공식 문서

- [텍스트 생성 및 REST 응답 구조](https://developers.openai.com/api/docs/guides/text)
- [대화 상태: 이전 메시지를 input에 포함하는 방법](https://developers.openai.com/api/docs/guides/conversation-state)
- [GPT-5.4 mini 모델과 지원 API](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
