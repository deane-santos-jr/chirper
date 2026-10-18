import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { getAgentThread } from '@/lib/db';
import { todayLocal } from '@/lib/domain/calendar';
import { isMutation } from './tools';

export interface AgentChange {
  text: string;
  failed: boolean;
}

export interface AgentTurnView {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageCount: number;
  changes: AgentChange[];
}

const DATE_PREFIX = /^\[Today is [^\]]+\]\n\n/;

type Block = Anthropic.Beta.BetaContentBlockParam;

function blocksOf(content: unknown): Block[] {
  return typeof content === 'string' ? [{ type: 'text', text: content }] : (content as Block[]);
}

function resultText(block: Anthropic.Beta.BetaToolResultBlockParam): string {
  if (typeof block.content === 'string') return block.content;
  return (block.content ?? []).map((part) => (part.type === 'text' ? part.text : '')).join(' ');
}

/**
 * Folds today's raw API thread into chat bubbles: one bubble per user message,
 * one per agent reply (all of its rounds merged), with each data change listed.
 */
export function todaysTranscript(): AgentTurnView[] {
  const turns: AgentTurnView[] = [];
  const toolNames = new Map<string, string>();
  let reply: AgentTurnView | null = null;

  getAgentThread(todayLocal()).forEach((message, index) => {
    const blocks = blocksOf(message.content);
    if (message.role === 'assistant') {
      reply ??= { id: `a${index}`, role: 'assistant', text: '', imageCount: 0, changes: [] };
      for (const block of blocks) {
        if (block.type === 'text' && block.text.trim()) reply.text = reply.text ? `${reply.text}\n\n${block.text}` : block.text;
        if (block.type === 'tool_use') toolNames.set(block.id, block.name);
      }
      if (!turns.includes(reply)) turns.push(reply);
      return;
    }

    const results = blocks.filter((block): block is Anthropic.Beta.BetaToolResultBlockParam => block.type === 'tool_result');
    for (const result of results) {
      const name = toolNames.get(result.tool_use_id) ?? '';
      if (reply && (isMutation(name) || result.is_error)) reply.changes.push({ text: resultText(result), failed: Boolean(result.is_error) });
    }

    const text = blocks.find((block): block is Anthropic.Beta.BetaTextBlockParam => block.type === 'text');
    if (text) {
      reply = null;
      turns.push({
        id: `u${index}`,
        role: 'user',
        text: text.text.replace(DATE_PREFIX, ''),
        imageCount: blocks.filter((block) => block.type === 'image').length,
        changes: [],
      });
    }
  });

  return turns;
}
