import { FeedbackQuestion } from "@/lib/shared/feedback/types";

export type FeedbackQuestionInfo = {
  key: FeedbackQuestion;
  label: string;
  question: string;
  help: string;
  required: boolean;
};

export const feedbackQuestions: readonly FeedbackQuestionInfo[] = [
  {
    key: FeedbackQuestion.Overall,
    label: "No geral",
    question: "Como você avalia o trabalho de {month}?",
    help: "Pense no mês inteiro.",
    required: true,
  },
  {
    key: FeedbackQuestion.Quality,
    label: "Criação e qualidade",
    question: "Os conteúdos combinam com a sua marca e com o que você esperava?",
    help: "Pense no visual, nos textos e no tom de voz.",
    required: false,
  },
  {
    key: FeedbackQuestion.Communication,
    label: "Comunicação",
    question: "A equipe explica as ideias e responde com clareza e rapidez?",
    help: "Pense nas mensagens, nas explicações e nos retornos.",
    required: false,
  },
  {
    key: FeedbackQuestion.Deadlines,
    label: "Prazos",
    question: "Os conteúdos chegam para aprovação e saem no dia combinado?",
    help: "Pense nas datas de envio e de publicação.",
    required: false,
  },
  {
    key: FeedbackQuestion.Results,
    label: "Resultados",
    question: "O trabalho está ajudando a marca a chegar onde você quer?",
    help: "Pense no que a marca queria alcançar com os conteúdos.",
    required: false,
  },
];

export const feedbackQuestionLabels: Record<FeedbackQuestion, string> = {
  [FeedbackQuestion.Overall]: "No geral",
  [FeedbackQuestion.Quality]: "Criação e qualidade",
  [FeedbackQuestion.Communication]: "Comunicação",
  [FeedbackQuestion.Deadlines]: "Prazos",
  [FeedbackQuestion.Results]: "Resultados",
};

const scoreWords: Record<number, string> = {
  1: "Muito abaixo do esperado",
  2: "Abaixo do esperado",
  3: "Dentro do esperado",
  4: "Acima do esperado",
  5: "Superou as expectativas",
};

export const feedbackScoreWord = (score: number | null | undefined): string =>
  score === null || score === undefined ? "" : (scoreWords[score] ?? "");

export const questionText = (info: FeedbackQuestionInfo, monthName: string): string =>
  info.question.replace("{month}", monthName);
