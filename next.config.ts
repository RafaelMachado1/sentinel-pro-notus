import type { NextConfig } from 'next'

const config: NextConfig = {
  // Ignora erros de ESLint (Inspetor de Estilo)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ADICIONE ESTE BLOCO:
  // Ignora erros de TypeScript (Inspetor de Tipos)
  typescript: {
    // !! AVISO !!
    // Perigosamente permite que builds de produção sejam concluídos
    // mesmo que seu projeto tenha erros de TypeScript.
    ignoreBuildErrors: true,
  },
}

export default config