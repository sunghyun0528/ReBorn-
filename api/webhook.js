export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userRequest } = req.body;
    const kakaoId = userRequest?.user?.id;
    const imageUrl = userRequest?.attachments?.[0]?.url;
    const textInput = userRequest?.utterance;

    // ── 1. Supabase에서 사장님 DNA 불러오기 ──
    const dbRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/owners?kakao_id=eq.${kakaoId}&select=dna_prompt`,
      {
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
      }
    );
    const dbData = await dbRes.json();
    const dnaPrompt = dbData?.[0]?.dna_prompt;

    if (!dnaPrompt) {
      return res.json({
        version: '2.0',
        template: {
          outputs: [{ simpleText: { text: '등록된 사장님 정보가 없습니다. 설문을 먼저 완료해주세요.' } }],
        },
      });
    }

    // ── 2. 이미지면 OCR, 텍스트면 그대로 사용 ──
    let reviewText = textInput;

    if (imageUrl) {
      const ocrRes = await fetch('https://ocr.apigw.ntruss.com/custom/v1/YOUR_OCR_ID/YOUR_OCR_SECRET/general', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OCR-SECRET': process.env.CLOVA_SECRET,
        },
        body: JSON.stringify({
          version: 'V2',
          requestId: 'reborn',
          timestamp: Date.now(),
          images: [{ format: 'jpg', name: 'review', url: imageUrl }],
        }),
      });
      const ocrData = await ocrRes.json();
      reviewText = ocrData.images?.[0]?.fields
        ?.map(f => f.inferText)
        .join(' ') || '텍스트 추출 실패';
    }

    // ── 3. Claude API로 답글 생성 ──
    const prompt = dnaPrompt.replace(
      '(여기에 손님 리뷰를 붙여넣으세요)',
      reviewText
    );

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const claudeData = await claudeRes.json();
    const reply = claudeData.content?.[0]?.text || '답글 생성 실패';

    // ── 4. 카카오톡으로 답글 반환 ──
    return res.json({
      version: '2.0',
      template: {
        outputs: [{ simpleText: { text: `📝 생성된 답글:\n\n${reply}` } }],
      },
    });

  } catch (err) {
    console.error(err);
    return res.json({
      version: '2.0',
      template: {
        outputs: [{ simpleText: { text: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.' } }],
      },
    });
  }
}
