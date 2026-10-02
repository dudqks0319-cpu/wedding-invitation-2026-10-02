# Codex 작업 1 — 청첩장 예시 사진 만들기

너는 이 저장소(`invitation-web/`, Next.js 16 + Tailwind v4)의 예시 이미지 담당이야.
지금 청첩장 디자인 19종에는 사진 대신 **만화풍 SVG 일러스트**(`public/samples/*.svg`)가 들어가 있어.
사용자가 "내 사진을 넣으면 이렇게 예쁘겠구나" 하고 느낄 수 있도록 **실사 느낌의 AI 웨딩·돌잔치·잔치 사진 26장**으로 바꾸는 게 목표야.

## 해야 할 일
1. `scripts/photo-brief.json` 을 읽어. 사진마다 `key`, `size`, `use`(어디에 쓰이는지), `prompt` 가 있고, 공통 스타일은 `style` 이야.
2. 각 사진을 **이미지 생성 도구**로 만들어 `public/photos/<key>.webp` 로 저장해 (`prompt` + 공통 `style` 을 이어 붙여서 사용, 크기는 `size` 기준).
   - 이미지 생성 도구를 쓸 수 없으면 대신 `npm run photos` 를 실행해 (`OPENAI_API_KEY` 환경 변수 필요, OpenAI 이미지 API 로 같은 결과를 만들어 줌).
   - 파일 하나는 400KB 이하로 (webp, 품질 80 정도). 너무 크면 `npx sharp-cli` 등으로 줄여.
3. 다 만들면 `npm run photos -- --manifest` 를 실행해서 `src/data/photos.generated.ts` 를 갱신해. → 화면은 이 목록을 보고 **자동으로** 일러스트 대신 사진을 써. 다른 코드는 고칠 필요 없어.
4. 품질 확인: `npm run dev` 후 `/templates` 와 `/i/sample-blossom`, `/i/sample-dol-balloon`, `/i/sample-party-peony` 를 열어서
   - 표지 모양(아치형, 원형, 폴라로이드, 필름 등)에 잘렸을 때 얼굴이 잘리지 않는지
   - 전체 톤이 **밝고 화사한지** (어둡거나 채도가 강한 사진은 다시 생성)
   - 글자·워터마크·이상한 손가락 같은 AI 티가 나는 부분이 없는지
   문제가 있는 사진은 프롬프트를 다듬어 그 key 만 다시 만들어 (`npm run photos -- --only <key> --force`).
5. `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run build:preview` 가 모두 통과하는지 확인해.

## 지켜야 할 것
- 모든 인물은 **가상의 성인/아기 모델**이어야 해. 실존 인물·연예인과 닮게 만들지 마.
- 사진 안에 글자, 로고, 워터마크, 테두리 넣지 마. (글자는 화면에서 따로 얹어)
- `public/samples/*.svg` 는 지우지 마 (사진이 없을 때 대신 쓰는 예비 그림이야).
- 바꾼 파일: `public/photos/*.webp`, `src/data/photos.generated.ts`, (필요하면) `scripts/photo-brief.json` 의 프롬프트.
- 커밋 메시지 예: `Add AI sample photos for invitation templates`
