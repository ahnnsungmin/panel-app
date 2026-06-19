/**
 * /api/auth.js  —  Vercel Serverless Function
 * 비밀번호 검증·저장을 서버(service_role)에서만 수행.
 * panel_config의 실제 비밀번호 값은 절대 브라우저로 내려가지 않음.
 *
 * 환경변수 (Vercel Dashboard > Settings > Environment Variables):
 *   SUPABASE_URL          Supabase 프로젝트 URL
 *   SUPABASE_SERVICE_KEY  Supabase service_role 키 (RLS 우회, 절대 클라이언트에 노출 금지)
 *   NOTIFY_SECRET         기존 알림 기능과 공유하는 비밀키 (index.html의 APP_SECRET과 동일해야 함)
 *   APP_URL               https://panelrequest.vercel.app
 *
 * 요청 형식 (action으로 분기):
 *   { action:'verify', type:'team'|'vendor'|'dept'|'admin', name, password }
 *     → { ok: true|false }
 *   { action:'save', adminPassword, key:'team_pw'|'vendor_pw'|'dept_pw'|'admin_pw'|'handlers', patch:{...} }
 *     → { ok: true } | { ok:false, error }
 *     (관리자 비밀번호를 먼저 검증한 뒤, 기존 값에 patch를 병합하여 저장)
 */

import { createClient } from '@supabase/supabase-js';

const DEFAULTS = {
  admin_pw: { value: 'admin' },
  team_pw: { '선실1팀': '1234', '창민기업': '1234', '해인이엔지': '1234' },
  vendor_pw: { '대진SAT': '1234', '비아이피': '1234', '성미': '1234', '세진기술산업': '1234' },
  dept_pw: { '선실1과': '1234', '선실2과': '1234' },
};

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

    // ── 로그인 검증 ──────────────────────────────────────────────────────────
    if (action === 'verify') {
      const { type, name, password } = req.body;
      if (password == null || password === '') return res.json({ ok: false });

      let stored;
      if (type === 'admin') {
        const cfg = (await getCfg('admin_pw')) || DEFAULTS.admin_pw;
        stored = cfg.value;
      } else {
        const keyMap = { team: 'team_pw', vendor: 'vendor_pw', dept: 'dept_pw' };
        const key = keyMap[type];
        if (!key) return res.status(400).json({ ok: false, error: 'Invalid type' });
        const cfg = (await getCfg(key)) || DEFAULTS[key];
        stored = cfg[name];
      }
      return res.json({ ok: stored !== undefined && stored === password });
    }

    // ── 설정 저장 (비밀번호 변경·담당자 목록 변경 등) ───────────────────────────
    if (action === 'save') {
      const { adminPassword, key, patch } = req.body;
      const allowedKeys = ['team_pw', 'vendor_pw', 'dept_pw', 'admin_pw', 'handlers'];
      if (!allowedKeys.includes(key)) return res.status(400).json({ ok: false, error: 'Invalid key' });

      const adminCfg = (await getCfg('admin_pw')) || DEFAULTS.admin_pw;
      if (adminCfg.value !== adminPassword) {
        return res.status(401).json({ ok: false, error: '관리자 비밀번호가 일치하지 않습니다' });
      }

      const existing = (await getCfg(key)) || DEFAULTS[key] || {};
      const merged = Object.assign({}, existing, patch);

      const { error } = await supabase.from('panel_config').upsert(
        { key, value: merged, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
