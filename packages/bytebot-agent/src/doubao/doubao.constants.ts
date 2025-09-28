import { BytebotAgentModel } from '../agent/agent.types';

export const DOUBAO_MODELS: BytebotAgentModel[] = [
  {
    provider: 'doubao',
    name: 'doubao-seed-1-6-250615',
    title: 'Doubao Seed 1.6',
    contextWindow: 256000, // 256K context window as mentioned in search results
  },
  {
    provider: 'doubao',
    name: 'doubao-seed-1.6-thinking',
    title: 'Doubao Seed 1.6 Thinking',
    contextWindow: 256000,
  },
  {
    provider: 'doubao',
    name: 'doubao-seed-1.6-flash',
    title: 'Doubao Seed 1.6 Flash',
    contextWindow: 256000,
  },
];

export const DEFAULT_MODEL = DOUBAO_MODELS[0];

// Doubao API endpoint (based on search results indicating it's based on Volcengine/ByteDance)
export const DOUBAO_API_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';