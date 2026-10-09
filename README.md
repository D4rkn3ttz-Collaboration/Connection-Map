# Connection-Map — 연결 3D

오픈웹(위 판)과 다크웹(아래 판)을 겹쳐 그리고, 두 층 영토 사이 연결을 선으로 잇는 3D 화면이다.
닥스훈트(오픈웹)와 다크초코(다크웹)가 같이 쓰는 저장소다.

    스택        Next.js(App Router) · TypeScript · Tailwind CSS — 2D 생태계 지도와 같다. 3D 그리기만 three.js
    맡은 쪽     다크초코 = 3D 공간 안(장면 · 블록 · 고르기 · 카메라)
                닥스훈트 = 그 밖 전부(머리띠 · 범례 · 검색 창 · 상세 패널 · 토글 · 안내 알약 · 회전 슬라이더)
                — 이렇게 보고 짰다. 연결선은 3D 안에 그려야 해서 지금은 이 장면이 그린다. 연결선을 누가 맡을지와
                카드 위 조작(토글 · 안내 알약 · 슬라이더)은 두 팀이 맞출 때 정한다
    기준        Figma 「③ 연결 (3D) 최종 흐름」 네 화면(③-0 ~ ③-3)이 먼저, 그다음 생태계 지도 설계서 4.4
    배포        https://d4rkn3ttz-collaboration.github.io/Connection-Map/ — main 에 들어가면 Actions 가 빌드해 올린다

2026-10-07 에 빌드 없는 시제품(HTML · JS · three.js CDN)을 이 스택으로 다시 짰다. 시제품의 계산과 시험은 `src/lib` 로 옮겼다.

## 여는 법

```
npm ci
npm run dev        # http://localhost:3004/Connection-Map  (주소 앞에 /Connection-Map 이 붙는다 — Pages 주소와 같게)
npm test           # 계산 시험 — node --experimental-strip-types --test src/lib/*.test.mjs
npm run build      # 정적 파일을 out/ 에 낸다(GitHub Pages 가 올리는 것)
npm run lint
```

| 주소 뒤에 | 무엇 | 없으면 |
|---|---|---|
| `?dark=<주소>` | 다크웹 배치 결과 파일(아래 「받는 자료」 칸 꼴) | 통합 Supabase 표 `public.dark_layout` |
| `?open=<주소>` | 오픈웹 배치 결과 파일(같은 칸 꼴) | 통합 Supabase 표 `public.open_layout` |
| `?links=<주소>` | 연결 줄 목록 파일(JSON 배열) | 통합 Supabase 공개 뷰 `links_public`. 뷰가 없거나 공개 읽기가 안 열렸거나 켜진 줄이 없으면 연결선 없이 그리고 「연결 자료 없음 — 까닭」 |

## 3D 컴포넌트 — 닥스훈트 화면이 얹을 자리

3D 장면은 `src/components/LinkScene3D.tsx` 하나다. 감싸는 화면이 자료를 한 번 받아 넘기고, **「지금 무엇을 골랐나」 를 들고 있다.**
3D 는 눌린 것을 알리고, 받은 것을 그린다. 그래서 검색 · 상세 패널 · 왼쪽 아래 정보 · 사이트 이동 버튼이 같은 값 하나를 본다.
영토는 늘 `{ web, territory_id }` 로 가리킨다(두 팀 약속 — 칸 이름도 표 칸과 같게 밑줄로 둔다).

```tsx
const [selected, setSelected] = useState<Pick | null>(null);
const scene = useRef<LinkScene3DHandle>(null);

<LinkScene3D
  ref={scene}
  dark={data.dark} open={data.open} lines={data.lines}        // src/lib/load.ts loadSceneData() 가 만든다
  selected={selected} onSelect={setSelected}
  onHover={setHover}
  showAllLinks={showAll}
  angle={angle} onAngleChange={setAngle}
  className="absolute inset-0"
/>

scene.current?.show({ web: "dark", territory_id: "forum-xxx" });  // 검색 결과 고르기
scene.current?.showIsland({ kind: "island", web: "open", island_id: "COMMUNITY" });  // 유형으로 이동
```

| 손잡이 | 방향 | 꼴 | 쓰는 둘레 기능 |
|---|---|---|---|
| `selected` | 받음 | `Pick \| null` | 패널 · 정보 · 사이트 이동 버튼이 읽고, 패널 닫기는 `null` 로 |
| `onSelect` | 알림 | `(pick: Pick \| null) => void` — 영토를 누르면 그 영토, 같은 영토를 다시 누르거나 빈 곳을 누르거나 Esc 면 `null` | 패널 열기 · 제목 줄 · 안내 알약 |
| `show()` | 부름(ref) | `show({ web, territory_id }): boolean` — 그 영토를 고르고(onSelect), 판 옆 · 뒤쪽이면 앞으로 돌리고, 다가간다 | 검색 결과 고르기 |
| `showIsland()` | 부름(ref) | `showIsland({ kind: "island", web, island_id }): boolean` — 섬 전체를 고르고 가운데로 이동한다 | 상세 패널 유형 고르기 |
| `onHover` | 알림 | `(t: { web, territory_id } \| null) => void` | 왼쪽 아래 정보 |
| `showAllLinks` | 받음 | `boolean` — 고른 것과 상관없이 연결선을 모두 그린다 | 「전체 관계 보기」 토글(켜면 연결선 전부, 끄면 고른 것의 선만) |
| `angle` · `onAngleChange` | 받음 · 알림 | `number`(0 ~ 360, 처음 160) · `(deg) => void` — 끌기 · `show()` 로 돌면 알린다 | 오른쪽 아래 회전 슬라이더 |

```ts
type Pick =
  | { kind: "territory"; web: "dark" | "open"; territory_id: string }
  | { kind: "island"; web: "dark" | "open"; island_id: string }   // 범례 · 패널에서 섬 하나
  | { kind: "link"; link_id: string };                             // 패널 연결 카드에서 관계 하나(Figma ③-3)
```

- `show()` 와 `showIsland()` 는 같은 영토·유형을 다시 골라도 매번 그쪽으로 이동할 수 있도록 부르는 손잡이로 둔다
- 확대는 3D 안 일이라 손잡이를 열지 않고, **휠 · 두 손가락으로만** 한다(Figma 에 확대 단추가 없다). 끌어서 돈 각은 `onAngleChange` 로 알린다
- 패널 「연결」 탭의 이어진 반대쪽 영토 목록은 3D 에서 받지 않고 `src/lib/links.ts` 의 `linksOf(lines, selected, layouts)` 로 같은 답을 얻는다
- 패널 「사건」 탭은 `public.incidents`와 `public.incidents_data_types`의 오픈웹 사건 제목·날짜·상태·노출 유형을 보여 준다. 공개 연결 기록의 사건 ID와 관측 시각도 함께 표시한다
- `src/components/Demo.tsx` 는 `TopBar` 의 검색, 3D 선택, 오른쪽 상세 패널을 같은 상태로 연결한다

## 상세 패널

왼쪽 범례에서 섬 색과 연결선 신뢰도를 볼 수 있다. 오른쪽 `상세 보기`는 영토를 고르기 전에도 열 수 있다. 전체 현황에서 유형을 누르면 해당 섬으로 이동하고, `포함된 영토`에서 개별 영토를 고를 수 있다. 영토를 고르면 `개요 · 사건 · 연결` 탭이 자동으로 펼쳐진다. 사건 탭은 기간별로 걸러 볼 수 있다. 사건이나 연결을 고르면 3D 장면의 선택 상태에도 반영된다. 공개 연결 기록이 없으면 빈 상태를 표시한다.

- 화면: `src/components/detail-panel/` (탭별 컴포넌트와 CSS Modules)
- 선택 상태: `src/hooks/useDetailPanel.ts`
- 사건 정렬·연결 데이터 가공: `src/lib/detail-panel.ts`, `src/lib/links.ts`
- 사건 목록은 `src/lib/load.ts`에서 Supabase 공개 표를 읽어 `DetailPanel`의 `incidents` 속성으로 넘긴다

## 무엇을 그리나 (Figma ③-0 ~ ③-3)

| | |
|---|---|
| 배경 | 카드 안 위쪽 흰색 → 아래 짙은 남색 그라데이션(설계서 「연결 3D」 색 다섯) |
| 판 | 같은 크기의 원판 둘. 위 = 오픈웹(거의 투명), 아래 = 다크웹(회청색 반투명). 둘레는 점선 |
| 판 사이 | 판 반지름의 1.8 배(`src/lib/scene.ts` `GAP_RATIO`) — 시제품 0.9 배에서 넓혔다(2026-10-07 피드백 「원판 간격 넓히기」) |
| 블록 | 칸 하나가 육각 기둥 하나. 다크웹 판은 지도가 계산한 칸 위치를 **그대로** 그린다(여기서 배치를 다시 계산하지 않는다 — 2D 와 영토 모양 · 크기가 같아야 해서). 칸 사이에 틈을 둔다 |
| 높낮이 | **섬 가운데가 높게, 평평한 층 세 단으로.** 섬 칸들의 무게중심에서 멀수록 한 단씩 낮고, 단은 넓이로 나눠 섬마다 세 단이 비슷한 넓이를 갖는다. 높이는 칸 반지름의 0.3 · 0.8 · 1.4 배(`H_TIERS`). 데이터와 상관없는 표시 규칙이다(설계서 3.5). 2026-10-07 피드백 「경사면이 그물처럼 보인다」 로 매끈한 경사에서 바꿨다 |
| 영토 경계 | 블록 윗면 둘레의 옅은 흰 선. 2D 영토 사이 선과 같은 변이다 |
| 색 | 섬 색. 다크웹은 `dark_layout.color`(2D 와 같은 색) |
| 이름표 · 툴팁 | 없다(Figma 에 없다). 마우스를 올린 영토는 `onHover` 로 알린다 |
| 고르기 | 고른 영토 · 섬, 그리고 반대쪽 층에서 그것과 이어진 영토만 높이 · 진한 색을 지키고 나머지는 납작하게 흐려진다. 관계를 고르면 그 두 끝 영토만 지킨다 |
| 연결선 | 위 판 영토 아래에서 내려와 아래 판 영토 윗면에 닿는 곡선 하나(#C2400D). 신뢰도 상 = 실선 · 중 = 파선 · 하 = 점선, 신뢰도가 비었으면 옅은 가는 실선(「높음」 과 헷갈리지 않게). 아래 끝에 동그라미(빨간 테두리 · 흰 가운데) |
| 카메라 | 기울기 30° 고정(설계서 4.4). 두 판 둘레가 화면 끝에서 조금 안쪽(폭 · 높이의 3%)에 다 들도록 거리를 맞추고 위아래 여백을 같게 한다(`fitCamera`). 화각을 12° 로 좁혀 두 판이 거의 같은 크기로 보이게 했다(Figma 처럼 원근이 약하게) |

### 설계서 4.4 와 다른 곳 (Figma 와 맡은 쪽을 따랐고, 확대는 피드백으로 더했다)

| 설계서 4.4 | 여기 | 까닭 |
|---|---|---|
| 섬 이름 클릭 → 섬 전체 진하게 | 3D 안에 섬 이름표가 없다. 섬 고르기는 밖(범례 · 패널)에서 `selected = { kind: "island", … }` 로 준다 | Figma ③-0 ~ ③-3 에 3D 안 이름표가 없다 |
| 연결이 없으면 「다른 층과 연결 없음」 안내 | 3D 는 글을 띄우지 않는다. 감싸는 화면이 `focusOf(…).lonely` 로 알고 안내 알약에 쓴다 | 안내 알약은 둘레(닥스훈트) 몫 |
| 패널 자동 펼침 · 회전 슬라이더 | 3D 는 `onSelect` · `onAngleChange` 로 알리기만 한다 | 패널 · 슬라이더는 둘레(닥스훈트) 몫 |
| (없음) 확대 | 휠 · 두 손가락으로만 | 2026-10-07 피드백으로 더함. Figma 에 단추가 없어 단추는 두지 않았다 |

층 높이 · 판 간격 · 화각(12°)은 **Figma 원본이 아니라 ③-0 화면 PNG 로 잰 값**이다. 원본 값이 있으면 `src/lib/scene.ts` 맨 위 상수(`H_TIERS` · `GAP_RATIO` · `FOV_DEG`)만 바꾼다.
우리 다크웹 판은 칸이 Figma 예시보다 훨씬 많아, 전체 화면에서는 칸이 작고 단 차이가 덜 보인다. 다가가면 또렷하다.

## 동작

| 하면 | 되는 것 |
|---|---|
| 처음 | 회전 160°, 연결선 숨김, 고른 것 없음 |
| 좌우 끌기(블록 위에서 시작해도 돈다) · `angle` | 0 ~ 360° 회전. 기울기는 고정. 다가가 있으면 화면 가운데 점을 두고 돈다 |
| 휠 · 두 손가락 벌리기 · 오므리기 | 다가가기 · 물러나기(0.8 ~ 6 배). 짚은 자리가 화면에서 제자리에 남는다(지도 앱과 같다). 확대 1 까지 물러나면 바라보는 점이 처음 자리(두 판 가운데)로 돌아온다(회전 각은 그대로) |
| 영토 누르기 | `onSelect` 로 알린다. 같은 영토를 다시 누르거나 빈 곳을 누르거나 Esc 면 `null` |
| `show()` | 그 영토를 고르고, 앞에서 60° 밖(판 옆 · 뒤쪽)이면 바로 앞에 오게 돌린 뒤 2.6 배로 다가간다(이미 더 가까우면 거리는 그대로). 움직임을 줄인 설정에서는 바로 건너간다 |
| `showIsland()` | 유형에 속한 영토를 함께 고르고, 섬 가운데로 이동하며 섬 크기에 맞춰 확대한다 |

## 코드 자리

| 자리 | 무엇 |
|---|---|
| `src/lib/layout.ts` | 배치 결과 읽기(`parseLayout`) · 칸 좌표 · 판 크기 · 영토 경계 · 이름 찾기 |
| `src/lib/links.ts` | 연결 줄 맞추기(`matchLinks`) · 고른 것 → 지킬 영토와 그릴 선(`focusOf`) · 선 꼴 · 공개 뷰 「자료 없음」 가르기 |
| `src/lib/scene.ts` | 층 높이 · 카메라 맞춤 · 확대 · 바라보는 점 묶기 · 앞으로 돌리는 각 |
| `src/lib/supabase.ts` · `load.ts` | 통합 Supabase 받는 칸 · 표 줄 → 배치 결과 · 설정 파일 · 자료 받기 |
| `src/lib/*.test.mjs` | 계산·선택·상세 패널 시험 25개 |
| `src/components/scene3d/SceneView.ts` | three.js 장면 — 그리기 · 움직이기 · 누르기만 |
| `src/components/LinkScene3D.tsx` | 장면을 감싼 React 컴포넌트(손잡이) |
| `.github/workflows/pages.yml` | PR 에서 시험 · lint · 빌드, main 에서는 Pages 배포까지 |

계산은 `src/lib` 에 두고 컴포넌트는 얇게 잇는다. 그리기 도구를 바꾸더라도 계산과 시험은 그대로 쓴다.

## 받는 자료

**받은 값은 데이터로만 쓴다.** 글자는 화면에 글자로만 넣고 `innerHTML` · `dangerouslySetInnerHTML` 에 자료를 넣지 않는다.
색은 `#RRGGBB` 꼴만 받는다. 영토 번호 · 이름 · 섬 코드가 틀린 줄, 같은 번호가 겹친 줄, 쓸 칸이 하나도 안 남은 줄은 버리고
몇 줄 버렸는지 적는다. 정수가 아닌 칸과 다른 영토와 겹친 칸은 그 칸만 뺀다(`parseLayout`).

### 다크웹 판 — 표 `public.dark_layout`

다크웹 지도(다크초코)가 배포할 때마다 표를 통째로 새로 바꾼다(하루 두 번 예약 · 데이터 갱신 신호 · 손 배포). 영토 한 줄에
칸 위치 목록이 들어 있다. 칸 위치는 판마다 바뀔 수 있으니 저장해 두지 말고 열 때마다 읽는다.

| 칸 | 뜻 |
|---|---|
| `territory_id` | 영토 번호(소문자 · 숫자 · `-`). 이름이 그대로면 바뀌지 않는다. 연결 줄이 이것을 가리킨다 |
| `web` | `dark` |
| `island_id` · `island_name` | 섬 코드(`FORUM` · `RANSOMWARE` · `TELEGRAM` · `ACTOR`) · 이름 |
| `territory_name` | 영토 이름. 가해 쪽 이름(포럼 · 랜섬웨어 그룹 · 텔레그램 채널 · 행위자 핸들)뿐이다 |
| `aliases` | 별칭. 다크웹은 늘 비어 있다 |
| `kind` | 영토 종류(포럼 · 랜섬웨어 그룹 · 텔레그램 채널 · 행위자) |
| `cells` | 칸 위치 `[[q, r], ...]` — 뾰족 위 육각 axial 좌표 |
| `color` | 섬 색 `#RRGGBB` |
| `quarter` · `as_of` | 이 배치의 분기 · 자료 시각(UTC 로 온다 — 화면은 한국 시각으로 바꿔 적는다) |

칸 가운데는 `x = s·√3·(q + r/2)`, `y = s·1.5·r` 이다(`s` 는 칸 반지름). 이웃 여섯은 `[q+1, r]` · `[q+1, r-1]` ·
`[q, r-1]` · `[q-1, r]` · `[q-1, r+1]` · `[q, r+1]` 이다.

### 오픈웹 판

기본값은 통합 Supabase의 `public.open_layout`이다. `dark_layout`과 같은 칸 꼴을 읽어 영토 번호·이름·섬·색·칸 위치를 그린다.
`?open=`으로 배치 결과 파일을 지정할 수도 있다. 같은 프로젝트의 `public.incidents`와 `public.incidents_data_types`를 공개 열쇠로 읽어
`incidents.platform_id`를 `open_layout.territory_id`의 `platform-<번호>`에 맞춘다. 사건 탭에는 제목·게시일(없으면 등록일)·상태와
노출 유형·설명을 표시한다. 500줄씩 나누어 읽으며, 사건 조회가 실패해도 영토는 그대로 그린다.

### 연결 — 공개 뷰 `links_public`

원본 표 `public.links` 는 공개 열쇠로 못 읽는다. 공개 뷰에는 **DB 반영이 켜진 줄만** 나오고, 피해 조직 · 근거 · 설명 ·
일치 항목처럼 이름이나 주소가 섞일 수 있는 칸은 없다. 뷰는 공개 열쇠로 읽기만 된다.

| 칸 | 뜻 |
|---|---|
| `link_id` | 연결 번호(`LNK-0001` 꼴) |
| `rel_type` | 관계 유형 — `SAME_DATASET` · `REPOST` · `SAME_CONTENT` · `SOURCE_CLAIM` · `SAME_ACTOR` · `CONTACT_MATCH` · `PROMOTION_OF` |
| `direction` · `verify_status` · `confidence` · `match_scope` | 관계 방향 · 검증 상태 · 신뢰도(상 · 중 · 하) · 일치 범위 |
| `dark_island` · `dark_territory` | 다크웹 섬 · 영토 |
| `open_island` · `open_territory` | 오픈웹 섬 · 영토 |
| `dark_observed_at` · `open_observed_at` | 양쪽 관측 시각 |
| `event_id` · `finding_id` | 다크초코 사건 번호(`LEAK-n`) · 오픈웹 발견 건 번호 |

`dark_territory` · `open_territory` 는 영토 번호나 이름 어느 쪽으로도 맞추고, 양 끝이 다 맞아야 선이 된다.
이름은 바뀔 수 있으니 **영토 번호를 넣기를 권한다.** 뷰가 없을 때(404 · PGRST205 · 42P01), 공개 읽기가 안
열렸을 때(42501), 켜진 줄이 없을 때는 오류가 아니라 「연결 자료 없음 — 까닭」 으로 적고 선 없이 그린다. 틀렸거나
거둔 열쇠 같은 그 밖의 401 · 403 은 오류로 적는다. 오픈웹 판이 없으면 줄 수만 적고 선은 긋지 않는다.

**통합 Supabase 는 공개 열쇠로만 읽는다**(apikey 머리글만 — 익명 역할). 설정 파일의 주소는 `https://<프로젝트>.supabase.co`
꼴만 받는다 — 열쇠가 다른 곳으로 가지 않게. 꼴이 틀리면 까닭(열쇠 값은 안 적는다)을 적고 그 판은 못 읽는다.

## 공개 저장소에 넣지 않는 것

이 저장소는 공개다.

- **공개 열쇠 하나만 넣는다**(아래 「공개 열쇠」). 비밀 열쇠 · 쓰기 열쇠는 넣지 않는다 — 쓰기 열쇠는 각 팀 배포 비밀값에만 있다.
  `data/` 안에서는 `data/supabase.json` 하나만 저장소에 들어가고(.gitignore), 시험 13(`src/lib/supabase.test.mjs`)이 그 파일에 공개 열쇠(`sb_publishable_`)만 있는지 본다
- **기업명 · 피해 조직명을 넣지 않는다**(2026-10-02 협업 회의 결정). 시험과 예시는 지어낸 이름만 쓴다
- 원본 DB 덤프 · 실제 배치 결과 파일을 넣지 않는다. 화면은 실행할 때 공개 표 · 뷰에서 받는다

## 공개 열쇠 (2026-10-06 결정)

`data/supabase.json` 에 통합 Supabase(link-3d)의 주소와 **공개 열쇠(publishable)** 를 넣어 둔다. 처음에는 공개 열쇠도 저장소 밖에
두었는데, 그러면 저장소를 받아 열거나 Pages 로 배포했을 때 다크웹 판이 비어 보여서 넣기로 했다. 빌드할 때 화면 코드에 함께 실린다.

- 공개 열쇠는 원래 웹 화면에 실려 누구나 보는 값이다. 무엇을 읽고 쓸 수 있는지는 열쇠가 아니라 DB 의 권한이 정한다
- 이 열쇠 하나로 읽히는 것은 공개용으로 만든 표 · 뷰뿐이다 — 3D 판 표 `dark_layout` · `open_layout`, 오픈웹 사건 표 `incidents` · `incidents_data_types`, 연결 공개 뷰 `links_public`, 그리고
  같은 프로젝트의 가이드라인 사이트가 공개로 내는 표. 원본 표(`links` 원본 줄 · 다크웹 원본 스키마)는 못 읽고, 쓰기는 모두 막혀 있다
  (2026-10-06 공개 열쇠로 확인: 원본 401 · 42501, 공개 뷰 쓰기 401 · 42501)
- 열쇠를 바꿀 때는 Supabase 대시보드 Project Settings → API Keys 에서 새 공개 열쇠를 만들어 이 파일을 바꾸고 옛 열쇠를 지운다

## 배포 (GitHub Pages)

- 정적 내보내기(`next.config.ts` 의 `output: "export"` · `basePath: "/Connection-Map"`)를 Actions 가 빌드해 올린다(`.github/workflows/pages.yml`)
- 저장소 Settings → Pages 의 원천이 **「GitHub Actions」** 여야 한다(2026-10-07 바꿨다 — 옛 시제품은 「main · 루트」 였다.
  바꾼 뒤에도 새 배포가 나갈 때까지는 옛 화면이 그대로 열린다)
- PR 에서는 시험 · lint · 빌드만 돌고 올리지 않는다

## 협업 규칙 (D4rkn3ttz-Collaboration)

- 가지는 `feature/영문` 으로 판다. main 에 바로 올리지 않는다
- 커밋 제목은 「작업명_번호」(예: `3D연결시제품_1`)
- PR 은 다른 팀 공동작업자 1명이 확인한 뒤 머지한다(급하면 예외). 올린 쪽이 혼자 머지하지 않는다

## 아직 안 한 것

- 켜진 연결 줄은 아직 없다. 로컬에서는 가짜 연결 자료로 선을 확인했다
- 사건 고르기(Figma ③-2) — 발견 · 재업로드 위치 자료가 정해지면
- 연결선을 고른 뒤 다른 웹 화면으로 넘어가는 주소 꼴(두 팀이 정할 것)
- 층 높이 · 판 간격 · 화각의 Figma 원본 값(지금은 PNG 로 잰 값)
- 실제 휴대폰 손가락으로는 못 해 봤다(가짜 터치 이벤트로만 확인)
