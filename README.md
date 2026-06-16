# 선실생산부 판넬 신청/입고 현황
## Vercel + Supabase + PWA 배포 가이드

---

## 1단계 · Supabase 프로젝트 생성

1. https://supabase.com → **Start your project** → 구글/GitHub 로그인
2. **New Project** 클릭
   - Name: `panel-app` (자유)
   - Password: 강력한 DB 비밀번호 설정
   - Region: **Northeast Asia (Seoul)** 선택
3. 프로젝트 생성 완료까지 약 1~2분 대기

---

## 2단계 · 데이터베이스 스키마 설치

1. Supabase 대시보드 좌측 → **SQL Editor**
2. `schema.sql` 파일 전체 내용을 복사
3. SQL Editor에 붙여넣고 **Run** (▶) 클릭
4. 성공 메시지 확인

---

## 3단계 · Realtime 활성화

1. 좌측 **Database** → **Replication**
2. `panel_apps` 와 `panel_config` 테이블 옆 토글을 **ON**으로 설정

---

## 4단계 · API 키 복사

1. 좌측 **Settings** → **API**
2. 다음 두 값을 복사:
   - **Project URL** (예: `https://abcdefgh.supabase.co`)
   - **anon public** key (긴 JWT 문자열)

---

## 5단계 · index.html 설정

`index.html` 파일에서 아래 두 줄을 찾아 실제 값으로 교체:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';  // ← 교체
const SUPABASE_KEY = 'YOUR_ANON_PUBLIC_KEY';                  // ← 교체
```

---

## 6단계 · Vercel 배포

### 방법 A: GitHub 연동 (권장)

1. 이 폴더를 GitHub 저장소에 업로드
   ```bash
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/YOUR_ID/panel-app.git
   git push -u origin main
   ```
2. https://vercel.com → **New Project** → GitHub 저장소 선택
3. Framework: **Other** (빌드 설정 없음)
4. **Deploy** 클릭

### 방법 B: Vercel CLI (빠름)

```bash
npm install -g vercel
cd panel-app
vercel --prod
```

배포 완료 후 URL 예: `https://panel-app.vercel.app`

---

## 7단계 · PWA 설치 (모바일 앱처럼 사용)

### 안드로이드 (Chrome)
1. 배포 URL 접속
2. 주소창 우측 **설치** 버튼 또는 메뉴 → **홈 화면에 추가**

### iOS (Safari)
1. 배포 URL을 Safari로 접속
2. 하단 공유 버튼(□↑) → **홈 화면에 추가**

---

## 초기 비밀번호

| 구분 | 초기값 |
|------|--------|
| 소속팀(선실1팀·창민기업·해인이엔지) | `1234` |
| 업체(대진SAT·비아이피·성미·세진기술산업) | `1234` |
| 담당과(선실1과·선실2과) | `1234` |
| 관리자 | `admin` |

> ⚠ 배포 후 반드시 관리자 모드에서 모든 비밀번호를 변경하세요.

---

## 아키텍처 요약

```
사용자 기기 (브라우저/PWA)
       │
       ▼
  Vercel (정적 호스팅, 무료)
  └── index.html  ← 앱 전체 (HTML+CSS+JS)
  └── sw.js       ← 서비스 워커 (오프라인 캐시)
       │
       ▼ Supabase JS 클라이언트 (CDN)
       │
  Supabase (PostgreSQL + Realtime, 무료 500MB)
  ├── panel_apps   ← 신청/입고 데이터
  └── panel_config ← 비밀번호·담당자 설정
```

### 실시간 동기화 흐름
- 누군가 신청/접수/배송/입고 처리 → Supabase에 즉시 저장
- Supabase Realtime → 다른 사용자 화면에 자동 반영 (새로고침 불필요)

---

## 비용

| 서비스 | 무료 한도 | 이 시스템 예상 사용량 |
|--------|-----------|----------------------|
| Vercel | 100GB 대역폭/월 | < 1GB |
| Supabase | DB 500MB, API 2M건/월 | < 50MB, < 10만건 |

**→ 무료 범위 내에서 운영 가능**

---

## 파일 목록

```
panel-app/
├── index.html       ← 메인 앱 (여기서 URL/KEY 설정)
├── manifest.json    ← PWA 설정
├── sw.js           ← 서비스 워커
├── icon-192.png    ← 앱 아이콘
├── icon-512.png    ← 앱 아이콘 (고해상도)
├── vercel.json     ← Vercel 배포 설정
├── schema.sql      ← Supabase DB 스키마
└── README.md       ← 이 파일
```
