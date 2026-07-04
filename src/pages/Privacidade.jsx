import LegalPageShell from '../components/LegalPageShell'

export default function Privacidade() {
  return (
    <LegalPageShell title="Política de Privacidade" updatedAt="03/07/2026">
      <p>
        Esta Política de Privacidade descreve como <strong>ZapFlow</strong>, operado por Leonardo Marusso
        (CPF 473.503.798-54), atuando sob a marca <strong>Marusso Produções</strong> ("controlador"/
        "operador", conforme o caso — ver seção 2), coleta, usa, armazena e protege dados pessoais, em
        conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </p>

      <h2>1. Quem é o responsável</h2>
      <p>
        Leonardo Marusso (CPF 473.503.798-54), atuando sob a marca Marusso Produções, com endereço em
        Indaiatuba - SP, é o responsável pelo tratamento de dados através do ZapFlow. Contato para questões
        de privacidade: leonardomarusso1@gmail.com.
      </p>

      <h2>2. Dois tipos de dados pessoais tratados — leia com atenção</h2>
      <p>
        O ZapFlow lida com dois grupos diferentes de dados pessoais, com papéis diferentes na LGPD:
      </p>
      <h3>2.1 Seus dados como cliente da ZapFlow (nós somos controladores)</h3>
      <ul>
        <li>Nome, e-mail, telefone e dados de cadastro da sua conta;</li>
        <li>Dados de cobrança (plano contratado, histórico de pagamento via Mercado Pago);</li>
        <li>Chave de acesso ao painel.</li>
      </ul>
      <h3>2.2 Dados dos SEUS contatos, que você importa no sistema (você é o controlador, nós somos operadores)</h3>
      <ul>
        <li>Nome, telefone, data de nascimento e tags dos contatos que você cadastra ou importa para disparo de mensagens;</li>
        <li>Conteúdo das mensagens/campanhas enviadas através da plataforma.</li>
      </ul>
      <p>
        <strong>Importante:</strong> ao importar contatos de terceiros (seus próprios clientes) no ZapFlow,
        <strong> você é o controlador desses dados</strong> perante a LGPD — é sua responsabilidade garantir
        que tem base legal (consentimento, execução de contrato, legítimo interesse legítimo, etc.) para
        tratar e enviar mensagens a essas pessoas. O ZapFlow atua como <strong>operador</strong>: processamos
        esses dados apenas para viabilizar o envio das suas campanhas, seguindo suas instruções.
      </p>

      <h2>3. Dados coletados automaticamente</h2>
      <p>Identificador de sessão de login, armazenado no seu navegador (ver Política de Cookies).</p>

      <h2>4. Para que usamos os dados (finalidade)</h2>
      <ul>
        <li>Viabilizar o funcionamento do serviço (autenticação, envio de mensagens via WhatsApp);</li>
        <li>Processar pagamentos e gerenciar assinatura/add-ons (via Mercado Pago);</li>
        <li>Suporte ao cliente;</li>
        <li>Segurança (prevenção de uso indevido que possa gerar bloqueio de número).</li>
      </ul>
      <p>Não vendemos dados pessoais a terceiros.</p>

      <h2>5. Base legal (LGPD, art. 7º)</h2>
      <p>
        Para os dados da sua conta (seção 2.1), tratamos com base em execução de contrato e cumprimento de
        obrigação legal (dados fiscais). Para os dados de contatos importados (seção 2.2), a base legal é
        definida por você, o controlador desses dados — nós apenas executamos o processamento sob suas
        instruções, como operador.
      </p>

      <h2>6. Com quem compartilhamos dados (operadores)</h2>
      <table>
        <thead><tr><th>Operador</th><th>Finalidade</th></tr></thead>
        <tbody>
          <tr><td>Supabase</td><td>Banco de dados, autenticação e armazenamento</td></tr>
          <tr><td>Z-API</td><td>Envio de mensagens via WhatsApp (a conexão do token acontece no servidor, nunca exposta ao navegador)</td></tr>
          <tr><td>Mercado Pago</td><td>Processamento de pagamentos e cobrança de add-ons</td></tr>
          <tr><td>Vercel</td><td>Hospedagem</td></tr>
        </tbody>
      </table>
      <p>
        Esses provedores podem armazenar dados em servidores no Brasil ou no exterior, com as salvaguardas
        contratuais exigidas pela LGPD.
      </p>

      <h2>7. Retenção de dados</h2>
      <p>
        Mantemos os dados enquanto sua conta estiver ativa e pelo período necessário para cumprir obrigações
        legais (dados fiscais). Ao encerrar o serviço, os dados (incluindo contatos importados) podem ser
        excluídos mediante solicitação, exceto o que a lei exigir manter.
      </p>

      <h2>8. Seus direitos como titular de dados</h2>
      <p>Conforme a LGPD, você pode solicitar, a qualquer momento, por leonardomarusso1@gmail.com:</p>
      <ul>
        <li>Acesso aos seus dados pessoais;</li>
        <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
        <li>Exclusão dos dados (observadas as retenções legais obrigatórias);</li>
        <li>Portabilidade dos dados a outro fornecedor de serviço;</li>
        <li>Informação sobre com quem seus dados foram compartilhados;</li>
        <li>Revogação do consentimento, quando o tratamento se basear nele.</li>
      </ul>
      <p>
        Se você é um contato importado por um cliente do ZapFlow (não o próprio cliente) e quer exercer
        esses direitos, procure diretamente a empresa que enviou a mensagem — ela é a controladora dos seus
        dados. Se preferir, entre em contato conosco que direcionamos a solicitação.
      </p>

      <h2>9. Segurança</h2>
      <p>
        Adotamos medidas técnicas razoáveis para proteger os dados (autenticação segura, criptografia em
        trânsito via HTTPS, tokens de API mantidos apenas no servidor). Em caso de incidente de segurança
        que afete dados pessoais, comunicaremos conforme exigido pela LGPD.
      </p>

      <h2>10. Cookies</h2>
      <p>O uso de cookies e tecnologias similares é detalhado na <a href="/cookies">Política de Cookies</a>.</p>

      <h2>11. Alterações desta política</h2>
      <p>Podemos atualizar esta Política periodicamente, comunicando alterações relevantes por e-mail.</p>

      <h2>12. Contato</h2>
      <p>Para exercer seus direitos ou tirar dúvidas: leonardomarusso1@gmail.com · (19) 99705-1919 · Indaiatuba - SP.</p>
    </LegalPageShell>
  )
}
