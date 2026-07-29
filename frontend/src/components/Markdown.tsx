import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

// Module constants: a fresh array per render would rebuild the plugin chain.
const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeHighlight];

const components: Components = {
  // The centre column is narrow (a 220px sidebar left, a 380px map right), so a
  // wide table has to scroll inside its own box rather than stretch the pane.
  table: ({ node: _node, ...props }) => (
    <div className="md-table-scroll">
      <table {...props} />
    </div>
  ),
  // Links the AI put in its answer: new tab, and don't hand over the referrer.
  a: ({ node: _node, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer" />
  ),
};

/**
 * Render an AI answer as Markdown.
 *
 * Raw HTML in the source is dropped, because `rehype-raw` is deliberately not
 * installed — an answer containing `<script>` stays text and never becomes DOM.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
