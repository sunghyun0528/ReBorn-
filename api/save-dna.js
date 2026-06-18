// api/save-dna.js
// DNA 설문 결과 저장 + store_code 자동 생성

function generateCode() {
  // 6자리 영숫자 대문자 (혼동되는 O, 0, I, 1 제외)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { store_name, category, menu, location, reply_length, track, dna_prompt, image_urls } = req.body;

    // store_code 생성 (중복 시 재시도)
    let store_code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const checkRes = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/owners?store_code=eq.${store_code}&select=store_code`,
        {
          headers: {
            'apikey': process.env.SUPABASE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
          },
        }
      );
      const existing = await checkRes.json();
      if (!existing?.length) break; // 중복 없으면 사용
      store_code = generateCode();
      attempts++;
    }

    const payload = {
      store_name,
      category,
      menu,
      location,
      reply_length,
      track,
      dna_prompt,
      image_urls: image_urls || null,
      store_code,
    };

    const supaRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/owners`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
        'Prefer':        'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!supaRes.ok) {
      const err = await supaRes.text();
      throw new Error(err);
    }

    const data = await supaRes.json();
    return res.status(200).json({ ok: true, id: data[0]?.id, store_code: data[0]?.store_code });

  } catch (err) {
    console.error('save-dna error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
