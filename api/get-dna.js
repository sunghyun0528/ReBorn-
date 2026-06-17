// api/get-dna.js
// Supabase에서 사장님 DNA 불러오기

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { id } = req.query;

    // id가 있으면 특정 사장님, 없으면 가장 최근 등록
    const query = id
      ? `${process.env.SUPABASE_URL}/rest/v1/owners?id=eq.${id}&select=id,store_name,dna_prompt,image_urls`
      : `${process.env.SUPABASE_URL}/rest/v1/owners?select=id,store_name,dna_prompt,image_urls&order=created_at.desc&limit=1`;

    const supaRes = await fetch(query, {
      headers: {
        'apikey':        process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
      },
    });

    if (!supaRes.ok) throw new Error(await supaRes.text());
    const data = await supaRes.json();

    if (!data?.[0]) return res.status(404).json({ ok: false, error: '등록된 DNA 없음' });
    return res.status(200).json({ ok: true, owner: data[0] });

  } catch (err) {
    console.error('get-dna error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
