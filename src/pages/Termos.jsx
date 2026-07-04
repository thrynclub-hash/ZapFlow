import LegalPageShell from '../components/LegalPageShell'

export default function Termos() {
  return (
    <LegalPageShell title="Termos de Uso" updatedAt="03/07/2026">
      <p>
        Estes Termos de Uso regulam o acesso e uso do serviço <strong>ZapFlow</strong>, oferecido por
        Leonardo Marusso (CPF 473.503.798-54), atuando sob a marca <strong>Marusso Produções</strong>
        ("nós"). Ao contratar ou usar o serviço, você ("cliente") concorda com estes termos.
      </p>

      <h2>1. Objeto do serviço</h2>
      <p>
        ZapFlow é uma plataforma de CRM e automação de relacionamento via WhatsApp, oferecida no modelo
        <strong> gerenciado</strong>: nós realizamos o setup inicial (conexão de API, configuração do número,
        importação de contatos) e entregamos o acesso pronto ao painel. A funcionalidade exata disponível
        depende do plano contratado.
      </p>

      <h2>2. Contratação</h2>
      <p>
        A contratação é feita mediante contato direto (WhatsApp/e-mail) e confirmação do plano desejado.
        Após a contratação, você recebe uma chave de acesso ao painel. Você é responsável por manter essa
        chave em sigilo e por todas as atividades realizadas com ela. Avise-nos imediatamente
        (leonardomarusso1@gmail.com) em caso de uso não autorizado.
      </p>

      <h2>3. Planos, limites e pagamento</h2>
      <p>
        O serviço é cobrado com uma taxa de setup única mais mensalidade recorrente, conforme o plano
        contratado (detalhado na página de planos e confirmado no momento da contratação). Ver
        <a href="/contrato-assinatura"> Contrato de Assinatura</a> para cobrança, cancelamento e reembolso.
      </p>

      <h2>4. Uso aceitável e conformidade com regras do WhatsApp</h2>
      <p>Você concorda em não usar o ZapFlow para:</p>
      <ul>
        <li>Disparo de mensagens em massa sem consentimento prévio dos destinatários (spam) — isso viola as políticas do WhatsApp e pode levar ao bloqueio do número, com custo e responsabilidade do cliente;</li>
        <li>Atividades ilegais ou que violem direitos de terceiros;</li>
        <li>Importar listas de contatos sem base legal para tratar esses dados (ver <a href="/privacidade">Política de Privacidade</a>, seção sobre dados de terceiros);</li>
        <li>Tentativas de acesso não autorizado a dados de outros clientes ou à infraestrutura do serviço;</li>
        <li>Engenharia reversa, cópia ou redistribuição do software (ver Licença de Uso).</li>
      </ul>
      <p>
        O ZapFlow inclui recursos para reduzir risco de bloqueio (variação de mensagens, pausa entre envios,
        opt-out), mas a responsabilidade final pelo conteúdo e pela base de contatos usada é do cliente.
      </p>

      <h2>5. Dados e conteúdo do cliente</h2>
      <p>
        Você mantém a titularidade sobre os dados que insere no serviço (contatos, mensagens, criativos).
        Ao usar o serviço, você nos concede uma licença limitada para armazenar e processar esses dados
        unicamente para operar o ZapFlow em seu nome. Quando você importa contatos de terceiros (seus
        próprios clientes), você declara ter base legal (LGPD) para esse tratamento — ver detalhes na
        Política de Privacidade.
      </p>

      <h2>6. Propriedade intelectual</h2>
      <p>
        O software, marca, design e código do ZapFlow são de propriedade exclusiva de Leonardo Marusso/
        Marusso Produções. Nada nestes Termos transfere qualquer direito de propriedade intelectual ao
        cliente além do direito de uso descrito na seção 1.
      </p>

      <h2>7. Disponibilidade e isenção de responsabilidade</h2>
      <p>
        Envidamos esforços razoáveis para manter o serviço disponível, mas não garantimos operação
        ininterrupta. O funcionamento do envio de mensagens depende também da API do WhatsApp/provedor
        externo (Z-API) e das políticas do próprio WhatsApp, fora do nosso controle direto — não nos
        responsabilizamos por bloqueios de número decorrentes de uso em desacordo com a seção 4.
      </p>

      <h2>8. Rescisão</h2>
      <p>
        Você pode encerrar o serviço a qualquer momento, conforme o Contrato de Assinatura. Podemos suspender
        ou encerrar contas que violem estes Termos, mediante aviso quando possível.
      </p>

      <h2>9. Alterações destes Termos</h2>
      <p>Podemos atualizar estes Termos periodicamente, comunicando alterações relevantes por e-mail ou WhatsApp.</p>

      <h2>10. Foro e legislação aplicável</h2>
      <p>
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de Indaiatuba - SP,
        ressalvado o direito do consumidor de optar pelo foro de seu domicílio, quando aplicável.
      </p>

      <h2>11. Contato</h2>
      <p>Dúvidas sobre estes Termos: leonardomarusso1@gmail.com · (19) 99705-1919.</p>
    </LegalPageShell>
  )
}
