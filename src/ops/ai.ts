// Calls to the server-side AI functions. The Anthropic key lives only in the Edge Function secrets.
// In local test mode, tests install a fake on window.__alignmentAI.
import { DATA_MODE } from '../data/repo';
import { supabase } from '../data/supabase';
import type { DumpContext } from './context';

export interface ParseRequest {
  text: string;
  context: DumpContext;
  /** On the one automatic retry: what was wrong with the first reply. */
  previousErrors?: string[];
  previousReply?: unknown;
}

export interface CoachRequest {
  kind: 'daily' | 'caption';
  name: string;
  whyShort: string;
  facts: Record<string, unknown>;
}

export interface DelegateRequest {
  task: { title: string; journey: string; notes: string; steps: { text: string; guess: boolean }[] };
}

export interface DelegateReply {
  steps: { text: string; guess: boolean }[];
  draft: string | null;
}

export interface AI {
  parse(req: ParseRequest): Promise<unknown>;
  coach(req: CoachRequest): Promise<string>;
  delegate(req: DelegateRequest): Promise<DelegateReply>;
}

declare global {
  interface Window {
    __alignmentAI?: Partial<AI>;
  }
}

async function invoke<T>(fn: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body: body as Record<string, unknown> });
  if (error) {
    // The function returns { error } with a plain message; surface it when present.
    let detail = '';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') detail = ((await ctx.json()) as { error?: string }).error ?? '';
    } catch {
      detail = '';
    }
    throw new Error(detail || error.message);
  }
  return data as T;
}

const unavailable = (): never => {
  throw new Error('The talk box needs the server. Local test mode has no AI.');
};

export const ai: AI = {
  parse: (req) => (DATA_MODE === 'local' ? (window.__alignmentAI?.parse ?? unavailable)(req) : invoke('parse-dump', req)),
  coach: (req) => (DATA_MODE === 'local' ? (window.__alignmentAI?.coach ?? unavailable)(req) : invoke<{ text: string }>('coach', req).then((r) => r.text)),
  delegate: (req) => (DATA_MODE === 'local' ? (window.__alignmentAI?.delegate ?? unavailable)(req) : invoke('delegate', req)),
};
