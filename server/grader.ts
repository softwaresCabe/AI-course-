// Rubric grading of written answers. The prompt is built server-side from the stored question, so the
// endpoint can't be used as a general-purpose proxy to the model.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { config } from './config';
import { gradingPrompt, normaliseGrade } from '../src/lib/prompts';
import type { ShortAnswer } from '../src/content/types';

const Grade = z.object({ scores: z.array(z.number()), feedback: z.string() });

let anthropic: Anthropic | null = null;

export async function gradeShortAnswer(q: ShortAnswer, answer: string) {
  anthropic ??= new Anthropic();
  const res = await anthropic.messages.parse({
    model: config.model,
    max_tokens: 8000,
    output_config: { format: zodOutputFormat(Grade), effort: 'medium' },
    messages: [{ role: 'user', content: gradingPrompt(q, answer) }],
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) return null;
  return normaliseGrade(q, res.parsed_output);
}
