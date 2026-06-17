// api/save-dna.js
// DNA 설문 결과 저장 + 트랙 A 이미지 URL 저장

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { store_name, category, menu, location, reply_length, track, dna_prompt, image_urls } = req.body;

    const payload = {
      store_name,
      category,
      menu,
      location,
      reply_length,
      track,
      dna_prompt,
      image_urls: image_urls || null,
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
    return res.status(200).json({ ok: true, id: data[0]?.id });

  } catch (err) {
    console.error('save-dna error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
