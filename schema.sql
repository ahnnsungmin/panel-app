-- ============================================================
-- 선실생산부 판넬 신청/입고 현황 · Supabase Schema
-- Supabase SQL Editor에 전체를 붙여넣고 실행하세요
-- ============================================================

-- 1. 판넬 신청 데이터 테이블
CREATE TABLE IF NOT EXISTS panel_apps (
  id          TEXT        PRIMARY KEY,
  week_no     INTEGER     NOT NULL,
  iso         DATE        NOT NULL,
  month       INTEGER,
  day         INTEGER,
  wd          TEXT,
  team        TEXT        NOT NULL,
  handler     TEXT        DEFAULT '',
  type        TEXT        NOT NULL CHECK (type IN ('Wall','Ceiling')),
  hull        TEXT        NOT NULL,
  dept        TEXT        NOT NULL,
  deck        TEXT        NOT NULL,
  panel_no    TEXT        NOT NULL,
  note        TEXT        DEFAULT '',
  vendor      TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'applied'
              CHECK (status IN ('applied','received','shipped','stocked')),
  eta         DATE,
  ship_date   DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 업데이트 시 자동으로 updated_at 갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER panel_apps_updated
  BEFORE UPDATE ON panel_apps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 조회 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_panel_apps_week     ON panel_apps(week_no);
CREATE INDEX IF NOT EXISTS idx_panel_apps_vendor   ON panel_apps(vendor, week_no);
CREATE INDEX IF NOT EXISTS idx_panel_apps_dept     ON panel_apps(dept, week_no);
CREATE INDEX IF NOT EXISTS idx_panel_apps_status   ON panel_apps(status);
CREATE INDEX IF NOT EXISTS idx_panel_apps_team     ON panel_apps(team, week_no);

-- 2. 설정 테이블 (비밀번호, 담당자 등)
CREATE TABLE IF NOT EXISTS panel_config (
  key         TEXT        PRIMARY KEY,
  value       JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER panel_config_updated
  BEFORE UPDATE ON panel_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Row Level Security 활성화
ALTER TABLE panel_apps   ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel_config ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책: anon 키로 읽기/쓰기 허용 (앱 레벨 비밀번호로 보안)
CREATE POLICY "anon_all_panel_apps"   ON panel_apps   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_panel_config" ON panel_config FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5. 기본 설정값 삽입
INSERT INTO panel_config (key, value) VALUES
  ('admin_pw',  '{"value":"admin"}'),
  ('team_pw',   '{"선실1팀":"1234","창민기업":"1234","해인이엔지":"1234"}'),
  ('vendor_pw', '{"대진SAT":"1234","비아이피":"1234","성미":"1234","세진기술산업":"1234"}'),
  ('dept_pw',   '{"선실1과":"1234","선실2과":"1234"}'),
  ('handlers',  '{"선실1팀":["안길용 팀장"],"창민기업":["이우연 소장","김종길 팀장","우현수 팀장"],"해인이엔지":["이채웅 소장","강강원 팀장","김대성 팀장"]}')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Realtime 활성화 (SQL Editor 대신 Supabase 대시보드에서 설정)
-- Database > Replication > panel_apps, panel_config 체크
-- ============================================================
