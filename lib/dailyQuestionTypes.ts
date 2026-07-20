import type { DailyCanvasTopicKey } from './natalHumanShared';

export type PersonalizedDailyQuestion = {
  id: string;
  topic: DailyCanvasTopicKey;
  question: string;
  teaser: string;
  answer: string;
};

export type PersonalizedDailyQuestionsPayload = {
  questions: PersonalizedDailyQuestion[];
};
