export const BRIEFING_FIELD_MAX = 2000;

export type BriefingFields = {
  audience: string;
  keyMessage: string;
  creativeDirection: string;
  constraints: string;
};

export type BriefingFieldSpec = {
  key: keyof BriefingFields;
  label: string;
  placeholder: string;
  rows: number;
};

export const emptyBriefingFields: BriefingFields = {
  audience: "",
  keyMessage: "",
  creativeDirection: "",
  constraints: "",
};

export const briefingFieldSpecs: readonly BriefingFieldSpec[] = [
  {
    key: "audience",
    label: "Público e contexto",
    placeholder:
      "Para quem é este conteúdo e o que está acontecendo? Ex.: clientes de bairro, início do inverno, lançamento do cardápio de chocolate quente.",
    rows: 3,
  },
  {
    key: "keyMessage",
    label: "Mensagem principal",
    placeholder:
      "O que a pessoa deve entender ou lembrar? Ex.: os dias frios ficam melhores com chocolate quente.",
    rows: 3,
  },
  {
    key: "creativeDirection",
    label: "Direção criativa",
    placeholder:
      "Como a arte e o vídeo devem parecer? Ex.: planos próximos, vapor da bebida, iluminação quente, música suave.",
    rows: 3,
  },
  {
    key: "constraints",
    label: "Tom e o que evitar",
    placeholder:
      "Voz da marca, informações obrigatórias e o que não pode aparecer. Ex.: tom acolhedor, citar o horário, sem promoções de desconto.",
    rows: 3,
  },
];
