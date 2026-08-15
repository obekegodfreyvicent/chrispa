import { Injectable } from '@nestjs/common';
import { ChatMessageDto } from './dto/chat-message.dto';

// FR-7.1 (docs/SRS.md §5.1): "ChrisPa Agent" — deliberately a basic,
// keyword-matched FAQ bot, not an LLM, per explicit user decision (the
// earlier Claude-API-backed version required a paid Anthropic key; this
// needs no external service, no credentials, and no ongoing cost). Purely
// local string matching against `FAQ_ENTRIES` below — no network call, so
// there's nothing to be "not configured".
//
// Same behavioral boundary as the earlier LLM version: this never claims to
// know a customer's order/account/payment details — anything that sounds
// account-specific is redirected to the real Support Ticket form (FR-7.3)
// rather than answered.
interface FaqEntry {
  keywords: string[];
  reply: string;
}

const GREETING_KEYWORDS = ['hi', 'hello', 'hey', 'hiya', 'good morning', 'good afternoon', 'good evening'];

const ACCOUNT_SPECIFIC_KEYWORDS = [
  'my order', 'order status', 'track my', 'tracking', 'my account', 'my payment',
  'password', 'log in', 'login', 'sign in', 'my refund', 'cancel my', 'where is my',
];

// Order matters: checked top to bottom, first match wins.
const FAQ_ENTRIES: FaqEntry[] = [
  {
    keywords: ['candle safety', 'wick', 'burn', 'burning', 'flame', 'fire hazard'],
    reply:
      'Candle safety tips: trim the wick to about 1/4 inch before each burn, burn on a heat-resistant surface away from drafts and anything flammable, never leave a burning candle unattended, keep away from children and pets, and stop burning once about 1/2 inch of wax remains.',
  },
  {
    keywords: ['ship', 'shipping', 'deliver', 'delivery', 'kampala'],
    reply:
      'ChrisPa currently delivers within Kampala, Uganda. Exact delivery timing and cost are confirmed at checkout.',
  },
  {
    keywords: ['return', 'refund', 'exchange', 'send back'],
    reply:
      'Unopened, unused products can generally be returned within a reasonable window of delivery for a refund or exchange. For a specific order\'s return, please use the "Submit a Ticket" form so our team can help directly.',
  },
  {
    keywords: ['ingredient', 'sourcing', 'sourced', 'natural', 'chemical', 'paraben', 'organic'],
    reply:
      "ChrisPa products are made from natural, locally-sourced ingredients — goat's milk, honey, herbs, ghee, soywax, beeswax, sea salt, and essential oils — with no harsh chemicals or parabens.",
  },
  {
    keywords: ['candle'],
    reply:
      "Our candles are made from soywax or beeswax with natural fragrance — a clean, longer burn than paraffin. Ask me about candle safety, or browse the Candles line in Shop.",
  },
  {
    keywords: ['soap'],
    reply:
      "Our soap bars are made with goat's milk and natural ingredients, gentle on skin. You'll find the full range under Soap Bars in Shop.",
  },
  {
    keywords: ['honey'],
    reply: 'Our honey is locally sourced in Uganda — pure, unprocessed, and great in tea, cooking, or on its own.',
  },
  {
    keywords: ['ghee'],
    reply: 'Our ghee is traditionally made, natural, and free from additives — a staple for cooking and baking.',
  },
  {
    keywords: ['sea salt', 'salt'],
    reply: 'Our sea salts are natural and unrefined, good for cooking and bath soaks alike.',
  },
  {
    keywords: ['product', 'line', 'what do you sell', 'what do you have'],
    reply:
      'ChrisPa has five product lines: Candles (soywax/beeswax), Sea Salts, Ghee, Honey, and Soap Bars (goat\'s milk) — all natural and chemical-free. Ask me about any of them, or browse Shop for the full catalog.',
  },
];

const ACCOUNT_REDIRECT_REPLY =
  "I can't access personal account, order, or payment details. Please use the \"Submit a Ticket\" form below, or check your Account page if you're signed in, and our team will help directly.";

const GREETING_REPLY =
  "Hi! I'm ChrisPa Agent 👋 I can help with product info, shipping, returns, candle safety, or ingredient sourcing — what would you like to know?";

const FALLBACK_REPLY =
  'I\'m not sure about that one — I can help with product info, shipping, returns, candle safety, or ingredient sourcing. For anything else, please use the "Submit a Ticket" form below.';

@Injectable()
export class ChatService {
  reply(dto: ChatMessageDto): { reply: string } {
    const text = dto.message.toLowerCase();

    if (ACCOUNT_SPECIFIC_KEYWORDS.some((kw) => text.includes(kw))) {
      return { reply: ACCOUNT_REDIRECT_REPLY };
    }
    if (GREETING_KEYWORDS.some((kw) => text.includes(kw))) {
      return { reply: GREETING_REPLY };
    }
    for (const entry of FAQ_ENTRIES) {
      if (entry.keywords.some((kw) => text.includes(kw))) {
        return { reply: entry.reply };
      }
    }
    return { reply: FALLBACK_REPLY };
  }
}
