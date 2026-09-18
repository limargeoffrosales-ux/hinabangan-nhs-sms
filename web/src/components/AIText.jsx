import { Fragment } from 'react';

// Renders plain AI output with light structure: "- " / "* " / "• " list lines
// become real bullet lists, blank-line-separated runs become paragraphs, and
// everything else keeps its line breaks. No HTML is involved — all children
// are plain strings, so there is no injection surface.
export default function AIText({ text }) {
  if (text == null) return null;
  const lines = String(text).split('\n');
  const nodes = [];
  let para = [];
  let list = [];
  let key = 0;

  const flushPara = () => {
    if (para.length) {
      nodes.push(<p className="ai-p" key={'p-' + key++}>{para.join('\n')}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      nodes.push(
        <ul className="ai-list" key={'ul-' + key++}>
          {list.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
      list = [];
    }
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet && bullet[1].trim()) {
      flushPara();
      list.push(bullet[1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  if (!nodes.length) nodes.push(<p className="ai-p" key="p-0">{String(text).trim()}</p>);
  return <Fragment>{nodes}</Fragment>;
}