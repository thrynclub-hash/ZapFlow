import LegalPageShell from '../components/LegalPageShell'

export default function ContratoAssinatura() {
  return (
    <LegalPageShell title="Contrato de Assinatura" updatedAt="03/07/2026">
      <p>
        Este Contrato regula a contratação do serviço <strong>ZapFlow</strong>, oferecido por Leonardo
        Marusso (CPF 473.503.798-54), atuando sob a marca <strong>Marusso Produções</strong>. Complementa os
        <a href="/termos"> Termos de Uso</a> — em caso de conflito específico sobre cobrança e assinatura,
        este contrato prevalece.
      </p>

      <h2>1. Estrutura de cobrança</h2>
      <p>
        Diferente de um checkout automático self-service, o ZapFlow é contratado mediante contato direto
        (WhatsApp/e-mail), com confirmação do plano, mensalidade e taxa de setup antes do início do
        serviço. A cobrança tem duas partes:
      </p>
      <ul>
        <li><strong>Taxa de setup (pagamento único):</strong> cobre a configuração inicial — conexão de API, número de WhatsApp, importação de contatos;</li>
        <li><strong>Mensalidade (cobrança recorrente):</strong> referente ao uso contínuo da plataforma, conforme o plano contratado (limite de contatos e recursos).</li>
      </ul>

      <h2>2. Processamento de pagamento</h2>
      <p>
        A cobrança recorrente e eventuais add-ons (ex.: ampliação de limite de contatos, número adicional)
        são processados via <strong>Mercado Pago</strong>. Não armazenamos dados de cartão de crédito — isso
        é feito inteiramente pelo Mercado Pago.
      </p>

      <h2>3. Direito de arrependimento (compra online)</h2>
      <p>
        Conforme o art. 49 do Código de Defesa do Consumidor, você tem o direito de <strong>desistir da
        contratação em até 7 (sete) dias corridos</strong> a partir da confirmação do plano, com
        <strong> reembolso integral</strong> da mensalidade paga. Se o setup (configuração inicial) já tiver
        sido iniciado a seu pedido expresso dentro desse prazo, a taxa de setup poderá ser cobrada
        proporcionalmente ao trabalho já realizado, conforme o art. 8º, §2º do Decreto 7.962/2013. Para
        exercer o direito de arrependimento, entre em contato em leonardomarusso1@gmail.com dentro do prazo.
      </p>

      <h2>4. Cancelamento</h2>
      <p>
        Você pode cancelar a assinatura a qualquer momento, solicitando por leonardomarusso1@gmail.com. O
        cancelamento interrompe a cobrança recorrente a partir do próximo ciclo; o acesso permanece até o
        fim do ciclo mensal já pago. A taxa de setup, por ser paga uma única vez pelo trabalho de
        configuração já entregue, não é reembolsável após o prazo da seção 3.
      </p>

      <h2>5. Reajuste de preço</h2>
      <p>
        Podemos reajustar o valor da mensalidade mediante aviso prévio de pelo menos 30 (trinta) dias por
        e-mail ou WhatsApp. O novo valor só se aplica a partir do próximo ciclo de cobrança após o aviso;
        você pode cancelar antes disso sem ônus caso não concorde com o novo valor.
      </p>

      <h2>6. Mudança de plano e add-ons</h2>
      <p>
        Upgrades de plano (mais contatos, números adicionais) podem ser contratados a qualquer momento,
        mediante contato, com cobrança do add-on correspondente via Mercado Pago.
      </p>

      <h2>7. Inadimplência</h2>
      <p>
        Em caso de falha na cobrança recorrente, poderemos suspender o envio de mensagens e o acesso ao
        painel até a regularização. Notificaremos por e-mail ou WhatsApp antes da suspensão.
      </p>

      <h2>8. Disponibilidade do serviço</h2>
      <p>
        Envidamos esforços para manter alta disponibilidade, mas o funcionamento do envio de mensagens
        também depende da API do WhatsApp/provedor externo, fora do nosso controle direto (ver Termos de
        Uso, seção 7). Não garantimos percentual específico de uptime.
      </p>

      <h2>9. Contato</h2>
      <p>Dúvidas sobre cobrança, cancelamento ou este contrato: leonardomarusso1@gmail.com · (19) 99705-1919.</p>
    </LegalPageShell>
  )
}
