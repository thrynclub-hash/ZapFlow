import { createPortal } from 'react-dom'

// Corrige um bug real: qualquer "position: fixed" dentro do Layout.jsx
// (que anima o conteúdo com .animate-fadein, uma propriedade transform)
// vira relativo a essa div animada, não à tela — cortando modais fora da
// área visível. Renderizar via portal direto no <body> resolve para
// qualquer modal do app, de uma vez.
export default function Modal({ children }) {
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/45 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        {children}
      </div>
    </div>,
    document.body
  )
}
