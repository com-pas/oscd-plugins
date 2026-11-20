const TAB = '  ';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function writeElement(el: Element, indent: string, parts: string[]): void {
  const attrs = el.attributes;
  let open = `<${el.tagName}`;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    open += ` ${attr.name}="${escapeXml(attr.value)}"`;
  }

  const kids: ChildNode[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (
      child.nodeType === Node.TEXT_NODE &&
      !(child.textContent ?? '').trim()
    ) {
      continue;
    }
    kids.push(child);
  }

  if (kids.length === 0) {
    parts.push(indent, open, '/>\n');
    return;
  }

  if (kids.length === 1 && kids[0].nodeType === Node.TEXT_NODE) {
    parts.push(
      indent,
      open,
      '>',
      escapeXml(kids[0].textContent ?? ''),
      `</${el.tagName}>\n`,
    );
    return;
  }

  parts.push(indent, open, '>\n');
  const next = indent + TAB;
  for (const child of kids) {
    writeNode(child, next, parts);
  }
  parts.push(indent, `</${el.tagName}>\n`);
}

function writeNode(node: Node, indent: string, parts: string[]): void {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      writeElement(node as Element, indent, parts);
      return;
    case Node.TEXT_NODE: {
      const text = (node.textContent ?? '').trim();
      if (text) parts.push(indent, escapeXml(text), '\n');
      return;
    }
    case Node.CDATA_SECTION_NODE:
      parts.push(indent, '<![CDATA[', node.textContent ?? '', ']]>\n');
      return;
    case Node.COMMENT_NODE:
      parts.push(indent, '<!--', node.textContent ?? '', '-->\n');
      return;
    case Node.PROCESSING_INSTRUCTION_NODE: {
      const pi = node as ProcessingInstruction;
      parts.push(
        indent,
        '<?',
        pi.target,
        pi.data ? ` ${pi.data}` : '',
        '?>\n',
      );
      return;
    }
    default:
      return;
  }
}

/** Pretty-print an XML document. Long lines stay on one line (no wrap). */
export function formatXml(doc: XMLDocument): string {
  const parts: string[] = ['<?xml version="1.0" encoding="UTF-8"?>\n'];
  if (doc.documentElement) {
    writeNode(doc.documentElement, '', parts);
  }
  return parts.join('');
}
