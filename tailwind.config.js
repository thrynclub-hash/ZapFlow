/** @type {import('tailwindcss').Config} */
//
// Identidade visual "Vocero" (2026-11-07) — reforma pedida pelo Leonardo pra
// aproximar o máximo possível do design real do vocero-crm (kevinrivm/
// vocero-crm, clonado em projects/vocero-reference pra extrair os tokens
// reais de src/app/globals.css, não só o README). Substitui a direção
// "Signal Ledger" (coral-magenta + Unbounded/Manrope) anterior.
//
// Mesma técnica de antes (ver histórico): redefinir os 8 tokens semânticos
// num lugar só muda a cor em todo o app, sem caçar cada ocorrência de
// `bg-card`/`text-accent`/etc. nos 17+ arquivos que já usam esses nomes.
// `white` continua redefinido pro ink (mesmo motivo de antes: 220+ usos de
// `text-white` como cor de texto principal, não branco literal).
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F6F8FC',            // "papel frío" do vocero — fundo da página
        card: '#FFFFFF',
        border: '#E1E9E4',
        accent: '#0D5BFF',        // azul elétrico "Vocero" — cor de assinatura nova
        'accent-dim': '#0A4DE6',
        violet: '#8B5CF6',        // sem equivalente no vocero, mantido (uso raro/destaque)
        muted: '#5F6A65',
        surface: '#EEF4F0',       // --bg-subtle do vocero (verde-menta claro)
        ink: '#141A17',           // --text do vocero
        white: '#141A17',
      },
      fontFamily: {
        display: ['Archivo', 'sans-serif'],
        body: ['Archivo', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
