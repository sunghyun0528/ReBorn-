// api/get-dna.js
// store_code로 사장님 DNA 불러오기

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { store } = req.query;

    if (!store) return res.status(400).json({ ok: false, error: 'store 코드가 없습니다.' });

    const query = `${process.env.SUPABASE_URL}/rest/v1/owners?store_code=eq.${store}&select=id,store_name,dna_prompt,image_urls,store_code`;

    const supaRes = await fetch(query, {
      headers: {
        'apikey':        process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
      },
    });

    if (!supaRes.ok) throw new Error(await supaRes.text());
    const data = await supaRes.json();

    if (!data?.[0]) return res.status(404).json({ ok: false, error: '등록된 DNA가 없습니다.' });
    return res.status(200).json({ ok: true, owner: data[0] });

  } catch (err) {
    console.error('get-dna error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
