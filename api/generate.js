// api/generate.js
// Claude API 답글 생성 + 사용량 제한 체크/카운트

const PLAN_LIMITS = {
  free:     10,
  pro:      200,
  business: 999999, // 사실상 무제한
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { dna_prompt, review_text, nickname, stars, image_url, store_code } = req.body;

    if (!dna_prompt) return res.status(400).json({ ok: false, error: 'DNA 프롬프트 없음' });
    if (!store_code) return res.status(400).json({ ok: false, error: 'store_code 없음' });

    // ── 1. 사장님 정보 + 사용량 조회 ──
    const ownerRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/owners?store_code=eq.${store_code}&select=id,plan,usage_count,usage_month`,
      {
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
      }
    );
    const owners = await ownerRes.json();
    const owner = owners?.[0];
    if (!owner) return res.status(404).json({ ok: false, error: '등록된 매장이 없습니다.' });

    const plan  = owner.plan || 'free';
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const thisMonth = currentMonth();

    // 이번 달 사용량 (월이 바뀌었으면 0부터)
    let usedCount = owner.usage_month === thisMonth ? (owner.usage_count || 0) : 0;

    // ── 2. 한도 초과 체크 ──
    if (usedCount >= limit) {
      return res.status(429).json({
        ok: false,
        limit_exceeded: true,
        plan,
        limit,
        used: usedCount,
        error: `이번 달 생성 한도(${limit}건)를 모두 사용했습니다.`,
      });
    }

    // ── 3. 메시지 구성 ──
    let messages;
    if (image_url) {
      const prompt = dna_prompt.replace(
        '(여기에 손님 리뷰를 붙여넣으세요)',
        '[이미지에서 리뷰 정보를 추출하여 답글을 작성해주세요]'
      );
      messages = [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: image_url } },
          {
            type: 'text',
            text: `위 이미지는 배민 리뷰 화면 캡처입니다.
이미지에서 다음을 추출하세요:
- 손님 닉네임
- 별점
- 리뷰 내용 (이모지 포함하여 그대로)

그리고 아래 사장님 DNA 프롬프트에 따라 즉시 답글을 작성하세요.
답글만 출력하세요. 추출된 정보나 설명은 출력하지 마세요.

${prompt}`
          }
        ]
      }];
    } else {
      const starEmoji = '⭐'.repeat(stars || 5);
      const reviewInfo = `${nickname ? nickname + '님 ' : ''}${starEmoji}\n${review_text}`;
      const prompt = dna_prompt.replace('(여기에 손님 리뷰를 붙여넣으세요)', reviewInfo);
      messages = [{ role: 'user', content: prompt }];
    }

    // ── 4. Claude API 호출 ──
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 500,
        messages,
      }),
    });

    const claudeData = await claudeRes.json();
    if (claudeData.error) throw new Error(claudeData.error.message);

    const reply = claudeData.content?.[0]?.text?.trim() || '';
    if (!reply) throw new Error('답글 생성 실패');

    // ── 5. 사용량 +1 업데이트 ──
    const newCount = usedCount + 1;
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/owners?id=eq.${owner.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':  'application/json',
          apikey:          process.env.SUPABASE_KEY,
          Authorization:   `Bearer ${process.env.SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          usage_count: newCount,
          usage_month: thisMonth,
        }),
      }
    );

    return res.status(200).json({
      ok: true,
      reply,
      usage: { used: newCount, limit, plan, remaining: limit - newCount },
    });

  } catch (err) {
    console.error('generate error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
