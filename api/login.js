// api/login.js
// 자체 로그인 — username + password 검증 후 store_code 반환

import crypto from 'crypto';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ ok: false, error: '아이디와 비밀번호를 입력해주세요.' });
    }

    const hash = hashPassword(password);

    const queryRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/owners?username=eq.${username}&select=store_code,store_name,password_hash,plan`,
      {
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
      }
    );
    const rows = await queryRes.json();
    const user = rows?.[0];

    if (!user) {
      return res.status(404).json({ ok: false, error: '존재하지 않는 아이디입니다.' });
    }
    if (user.password_hash !== hash) {
      return res.status(401).json({ ok: false, error: '비밀번호가 일치하지 않습니다.' });
    }
    if (!user.store_code) {
      return res.status(400).json({ ok: false, error: '설문이 완료되지 않은 계정입니다. 설문을 먼저 진행해주세요.' });
    }

    return res.status(200).json({
      ok: true,
      store_code: user.store_code,
      store_name: user.store_name,
      plan: user.plan || 'free',
    });

  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
