/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Nenhuma env pública (NEXT_PUBLIC_*) é definida aqui de propósito.
  // Segredos (Supabase service role, credenciais do Drive) só existem
  // em código server-side (Route Handlers / Server Components / lib server-only).
};

module.exports = nextConfig;
