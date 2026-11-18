import { useMemo } from 'react';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

/** Renders trusted, bundled course markdown (never user or model input). */
export function Markdown({ src, className = 'lecture' }: { src: string; className?: string }) {
  const html = useMemo(() => marked.parse(src, { async: false }) as string, [src]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Inline markdown for short strings (prompts, options). Escapes HTML first. */
export function Inline({ text }: { text: string }) {
  const html = useMemo(() => {
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/`([^`]+)`/g, '<code class="font-mono text-[0.88em] bg-brand-soft/60 text-brand-deep px-1 rounded">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }, [text]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Plain text with paragraphs, for model (AI TA) output — rendered as text, never as HTML. */
export function PlainText({ text }: { text: string }) {
  return (
    <div className="space-y-2 whitespace-pre-wrap text-sm leading-relaxed">
      {text}
    </div>
  );
}
