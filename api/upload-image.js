// api/upload-image.js
// 이미지 파일을 Supabase Storage에 업로드 후 공개 URL 반환

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const fileName = req.headers['x-file-name'];
    const fileType = req.headers['x-file-type'] || 'image/jpeg';

    if (!fileName) return res.status(400).json({ ok: false, error: 'x-file-name 헤더 없음' });

    // 요청 body를 그대로 Supabase Storage로 전달
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const uploadRes = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/review-captures/${fileName}`,
      {
        method: 'POST',
        headers: {
          'apikey':        process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
          'Content-Type':  fileType,
        },
        body: buffer,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(err);
    }

    const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/review-captures/${fileName}`;
    return res.status(200).json({ ok: true, url });

  } catch (err) {
    console.error('upload-image error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
