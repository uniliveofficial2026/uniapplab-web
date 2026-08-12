import { config } from 'dotenv';
import { streamText } from 'ai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, '.env.local') });
config({ path: path.join(here, '..', '.env.local') });
config();

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    throw new Error(
      'Missing AI_GATEWAY_API_KEY (or VERCEL_OIDC_TOKEN). Add it to ai-gateway-demo/.env.local or repo .env.local',
    );
  }

  // Primary model per setup request; gateway falls back if free-tier blocks it.
  const result = streamText({
    model: 'openai/gpt-5.4',
    prompt: 'Invent a new holiday and describe its traditions in 3 short paragraphs.',
    providerOptions: {
      gateway: {
        models: ['openai/gpt-5.4', 'google/gemini-2.5-flash', 'openai/gpt-4.1-nano'],
      },
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
