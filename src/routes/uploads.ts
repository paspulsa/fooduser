import { Hono } from 'hono';
import { Bindings } from '../types';

export const uploadRouter = new Hono<{ Bindings: Bindings }>();

// Kredensial Cloudinary Anda
const CLOUD_NAME = 'dop2dlzqp';
const API_KEY = '511514329953514';
const API_SECRET = 'Pum7GsjmcrCuc0F0mJDO0stSQTw';

uploadRouter.post('/', async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File;

  if (!file) {
    return c.json({ success: false, message: 'Tidak ada berkas yang diunggah!' }, 400);
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folderName = 'food_delivery';

    // 1. Pembuatan Signature Cloudinary (WAJIB Urut Abjad)
    // Aturan Cloudinary: Parameter harus diurutkan secara alfabet. (f)older baru (t)imestamp
    const signatureString = `folder=${folderName}&timestamp=${timestamp}${API_SECRET}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 2. Siapkan FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', API_KEY);
    formData.append('folder', folderName); // Harus sama persis dengan yang di-signature
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    
    // 3. Eksekusi Upload ke Cloudinary
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    
    const response = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData
    });

    const result = await response.json() as any;

    if (!response.ok || result.error) {
      console.error("Cloudinary Error Log:", result.error);
      return c.json({ success: false, message: result.error?.message || 'Gagal mengunggah gambar' }, 500);
    }

    // 4. Outputkan URL yang Teroptimasi 
    // Menyisipkan /f_auto,q_auto/ di antara /upload/ agar ukuran gambar ringan
    const optimizedUrl = result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');

    return c.json({
      success: true,
      message: 'Berkas sukses diunggah ke Cloudinary',
      url: optimizedUrl,
      fileName: result.public_id
    });

  } catch (error: any) {
    console.error("Kesalahan Sistem:", error);
    return c.json({ success: false, message: 'Terjadi kesalahan sistem saat unggah gambar.' }, 500);
  }
});
