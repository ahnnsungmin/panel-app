/**
 * /api/manage-apps.js  —  Vercel Serverless Function
 * panel_apps의 "삭제" 작업을 서버(service_role)에서만 수행.
 * RLS에서 anon DELETE 권한을 제거했기 때문에, 삭제는 반드시 이 함수를 통해야 함.
 *
 * 환경변수: api/auth.js와 동일 (SUPABASE_URL, SUPABASE_SERVICE_KEY, NOTIFY_SECRET, APP_URL)
 *
 * 요청 형식:
 *   { action:'delete', id, password }       — 개별 신청 삭제 (해당 건의 소속팀 비밀번호 필요)
 *   { action:'resetAll', adminPassword }    — 전체 초기화 (관리자 비밀번호 필요)
 */

import { createClient } from '@supabase/supabase-js';

const DEFAULT_TEAM_PW = { '선실1팀': '1234', '창민기업': '1234', '해인이엔지': '1234' };
const DEFAULT_ADMIN_PW = { value: 'admin' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const secret = req.headers['x-app-secret'];
  if (secret !== process.env.NOTIFY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  async function getCfg(key) {
    const { data, error } = await supabase
      .from('panel_config').select('value').eq('key', key).maybeSingle();
    if (error) throw error;
    return data?.value;
  }

  try {
    const { action } = req.body;

    // ── 개별 신청 삭제 ───────────────────────────────────────────────────────
    if (action === 'delete') {
      const { id, password } = req.body;
      if (!id) return res.status(400).json({ ok: false, error: 'id 누락' });

      const { data: row, error: fErr } = await supabase
        .from('panel_apps').select('team').eq('id', id).maybeSingle();
      if (fErr) throw fErr;
      if (!row) return res.status(404).json({ ok: false, error: '신청 건을 찾을 수 없습니다' });

      const teamPw = (await getCfg('team_pw')) || DEFAULT_TEAM_PW;
      const stored = teamPw[row.team] ?? DEFAULT_TEAM_PW[row.team];
      if (stored === undefined || stored !== password) {
        return res.status(401).json({ ok: false, error: '비밀번호가 일치하지 않습니다' });
      }

      const { error: dErr } = await supabase.from('panel_apps').delete().eq('id', id);
      if (dErr) throw dErr;
      return res.json({ ok: true });
    }

    // ── 전체 초기화 ──────────────────────────────────────────────────────────
    if (action === 'resetAll') {
      const { adminPassword } = req.body;
      const cfg = (await getCfg('admin_pw')) || DEFAULT_ADMIN_PW;
      if (cfg.value !== adminPassword) {
        return res.status(401).json({ ok: false, error: '관리자 비밀번호가 일치하지 않습니다' });
      }
      const { error } = await supabase.from('panel_apps').delete().neq('id', '');
      if (error) throw error;
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
