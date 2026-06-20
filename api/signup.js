// api/signup.js
// 자체 회원가입 — username + password 해시 저장

import crypto from 'crypto';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function validate(username, password) {
  // 아이디: 영문/숫자만, 4~20자
  if (!/^[a-zA-Z0-9]{4,20}$/.test(username)) {
    return '아이디는 영문, 숫자 4~20자로 입력해주세요.';
  }
  // 비밀번호: 8자 이상, 영문+숫자 필수
  if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return '비밀번호는 영문과 숫자를 모두 포함해야 합니다.';
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ ok: false, error: '아이디와 비밀번호를 입력해주세요.' });
    }

    const validationError = validate(username, password);
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }

    // 중복 아이디 체크
    const checkRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/owners?username=eq.${username}&select=username`,
      {
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
      }
    );
    const existing = await checkRes.json();
    if (existing?.length) {
      return res.status(409).json({ ok: false, error: '이미 사용 중인 아이디입니다.' });
    }

    // 가입은 username/password만 먼저 저장 (DNA는 설문 완료 시 업데이트)
    return res.status(200).json({
      ok: true,
      username,
      password_hash: hashPassword(password),
    });

  } catch (err) {
    console.error('signup error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
