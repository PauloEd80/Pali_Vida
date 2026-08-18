/**
 * Dados de demonstração do PaliVida.
 *
 * Espelham exatamente backend/src/seed.js do código-fonte original: os 12
 * sintomas do app publicado, os conteúdos educativos e os 3 usuários de teste
 * (senha "palivida123" para todos). Isso alimenta o "banco" em js/db.js.
 */
window.PALIVIDA_SEED = {
  sintomas: [
    'Constipação Intestinal',
    'Fraqueza',
    'Sonolência',
    'Tristeza (Depressão)',
    'Ansiedade',
    'Dor',
    'Náusea e Vômitos',
    'Dispneia (Falta de ar)',
    'Fadiga e Cansaço',
    'Xerostomia (Boca seca)',
    'Bem Estar',
    'Anorexia e Falta de apetite',
  ],

  conteudos: [
    {
      titulo: 'Constipação Intestinal',
      descricao: 'Evacuações pouco frequentes, difíceis ou incompletas.',
      sinaissintomas: [
        'Dificuldade ou incapacidade de evacuar',
        'Força para evacuar',
        'Menos de três evacuações por semana',
        'Eliminação de fezes endurecidas',
        'Sensação de esvaziamento incompleto do reto',
      ].join('\n'),
      sinaisalerta: [
        'Início rápido',
        'Náuseas ou vômito',
        'Dificuldade na eliminação de flatos',
        'Dor intensa',
        'Distensão abdominal',
        'Perda de peso sem explicação',
        'Sangramento retal',
      ].join('\n'),
    },
    {
      titulo: 'Dor',
      descricao:
        'Experiência sensorial e emocional desagradável, avaliada sempre pelo relato da pessoa.',
      sinaissintomas: [
        'Dor contínua ou em pontadas',
        'Piora ao movimento',
        'Dificuldade para dormir por causa da dor',
        'Irritabilidade e cansaço',
      ].join('\n'),
      sinaisalerta: [
        'Dor súbita e muito intensa',
        'Dor que não melhora com a medicação prescrita',
        'Dor acompanhada de falta de ar ou confusão mental',
      ].join('\n'),
    },
    {
      titulo: 'Dispneia (Falta de ar)',
      descricao: 'Sensação subjetiva de desconforto para respirar.',
      sinaissintomas: [
        'Respiração curta ou acelerada',
        'Cansaço aos pequenos esforços',
        'Necessidade de dormir com a cabeceira elevada',
      ].join('\n'),
      sinaisalerta: [
        'Falta de ar em repouso',
        'Lábios ou dedos arroxeados',
        'Confusão mental ou agitação',
        'Chiado intenso no peito',
      ].join('\n'),
    },
  ],

  // senha "palivida123" para os três — texto puro só porque isto roda 100%
  // no navegador, sem servidor de verdade. Ver README do site.
  usuarios: {
    administrador: {
      nome: 'Administrador Demo',
      email: 'admin@palivida.local',
      senha: 'palivida123',
      formacao: 'Medicina',
      conselho_profissional: 'CRM',
    },
    paciente: {
      nome: 'Paciente Demo',
      email: 'paciente@palivida.local',
      senha: 'palivida123',
      cidade: 'Londrina',
      estado: 'PR',
      tipo_sanguineo: 'O+',
    },
    acompanhante: {
      nome_completo: 'Cuidador Demo',
      email: 'cuidador@palivida.local',
      senha: 'palivida123',
      relacionamento: 'filho(a)',
    },
  },

  // Registros iniciais (mesmas 4 primeiras "sintomas" x intensidades do seed original)
  registrosIniciais: [3, 7, 5, 9, 2, 6],
};
