import type { NextConfig } from 'next'

const config: NextConfig = {
  // ADICIONE ESTAS LINHAS:
  eslint: {
    // Aviso: Isso permite que builds de produção sejam concluídos mesmo
    // que seu projeto tenha erros de ESLint.
    ignoreDuringBuilds: true,
  },
}

export default config