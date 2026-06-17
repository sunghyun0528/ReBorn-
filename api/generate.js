// api/generate.js
// Claude API 답글 생성 + Supabase Storage 이미지 업로드

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { dna_prompt, review_text, nickname, stars, image_url } = req.body;

    if (!dna_prompt) return res.status(400).json({ ok: false, error: 'DNA 프롬프트 없음' });

    let messages;

    if (image_url) {
      // 이미지 모드 — Storage URL로 Claude Vision 호출
      const prompt = dna_prompt.replace(
        '(여기에 손님 리뷰를 붙여넣으세요)',
        '[이미지에서 리뷰 정보를 추출하여 답글을 작성해주세요]'
      );
      messages = [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: image_url }
          },
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
      // 텍스트 모드
      const starEmoji = '⭐'.repeat(stars || 5);
      const reviewInfo = `${nickname ? nickname + '님 ' : ''}${starEmoji}\n${review_text}`;
      const prompt = dna_prompt.replace('(여기에 손님 리뷰를 붙여넣으세요)', reviewInfo);
      messages = [{ role: 'user', content: prompt }];
    }

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

    return res.status(200).json({ ok: true, reply });

  } catch (err) {
    console.error('generate error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
