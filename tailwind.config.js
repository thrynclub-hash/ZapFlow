/** @type {import('tailwindcss').Config} */
//
// Identidade visual "Signal Ledger" (2026-07-03) — fundo claro premium
// (like the "Ledger" direction) + cor de assinatura e tipografia da direção
// "Signal" (coral-magenta + Unbounded/Manrope). Escolhida pelo Leonardo entre
// 3 direções para ser a base visual de todo o ecossistema — ver
// docs/design-system/ na raiz do mega-brain quando for propagar pros
// outros projetos.
//
// `white` é redefinido de propósito (de #FFFFFF pro ink escuro): o app
// inteiro foi construído em dark mode com `text-white` como cor de texto
// principal (220+ ocorrências em 17 arquivos) — redefinir o token em vez de
// editar cada ocorrência resolve todas de uma vez, sem precisar caçar cada
// uma. `bg-white`/`border-white` também são afetados por essa redefinição —
// os únicos 2 usos de bg-white no projeto (bolinha do toggle switch em
// NewCampaign.jsx/Birthdays.jsx) foram trocados pra bg-[#ffffff] literal de
// propósito, pra continuarem brancos de verdade.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F7F5F1',            // fundo — papel claro premium, não branco puro
        card: '#FFFFFF',
        border: '#E7E2D8',
        accent: '#FF4D6D',        // coral-magenta — cor de assinatura
        'accent-dim': '#E23F5C',
        violet: '#8B5CF6',        // segunda cor do gradiente (uso raro, só destaque)
        muted: '#6B6560',
        surface: '#FBFAF7',
        ink: '#17141A',           // texto principal / mesmo valor de white (ver nota acima)
        white: '#17141A',
      },
      fontFamily: {
        display: ['Unbounded', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
