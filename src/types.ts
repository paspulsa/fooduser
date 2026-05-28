export type Bindings = {
  DB: D1Database;          // Database Cloudflare D1
  IMAGE_BUCKET: R2Bucket;  // Storage Cloudflare R2 untuk Gambar
  JWT_SECRET: string;      // Secret Key JWT HS256
  R2_PUBLIC_URL: string;   // URL Publik R2 (misal: https://pub-xxx.r2.dev)
};

export type Variables = {
  jwtPayload: {
    id: string;
    email: string;
    role: string;
  };
};