/**
 * Apply one OpenSCD `oscd-edit-v2` payload the way CoMPAS does
 * (`@openscd/oscd-editor` `handleEdit`).
 *
 * scl-lib sends batches and attribute edits without `attributesNS`.
 * Those must not be treated as `textContent` updates.
 */

type AttributeMap = Record<string, string | null | undefined>;
type NamespacedAttributes = Record<string, AttributeMap>;

type InsertEdit = {
  parent: Node;
  node: Node;
  reference: Node | null;
};

type RemoveEdit = {
  node: Node;
  parent?: undefined;
};

type AttributesEdit = {
  element: Element;
  attributes?: AttributeMap;
  attributesNS?: NamespacedAttributes;
};

type TextEdit = {
  element: Element;
  textContent: string;
};

export function applyOscdEdit(edit: unknown): void {
  if (Array.isArray(edit)) {
    for (const entry of edit) applyOscdEdit(entry);
    return;
  }
  if (!isRecord(edit)) return;

  if (isInsert(edit)) {
    try {
      edit.parent.insertBefore(edit.node, edit.reference);
    } catch {
      // Same as the host: a rejected insert does not abort the rest of a batch.
    }
    return;
  }
  if (isRemove(edit)) {
    edit.node.parentNode?.removeChild(edit.node);
    return;
  }
  if (isAttributes(edit)) {
    applyAttributes(edit);
    return;
  }
  if (isText(edit)) {
    edit.element.textContent = edit.textContent;
  }
}

function applyAttributes(edit: AttributesEdit): void {
  const attributes = edit.attributes ?? {};
  const attributesNS = edit.attributesNS ?? {};

  for (const [name, value] of Object.entries(attributes)) {
    try {
      if (value === null) edit.element.removeAttribute(name);
      else if (value !== undefined) edit.element.setAttribute(name, value);
    } catch {
      // Invalid name: leave this attribute and continue the batch.
    }
  }

  for (const [namespace, attrs] of Object.entries(attributesNS)) {
    if (!attrs) continue;
    for (const [name, value] of Object.entries(attrs)) {
      try {
        const localName = name.split(':').pop() ?? name;
        if (value === null) edit.element.removeAttributeNS(namespace, localName);
        else if (value !== undefined)
          edit.element.setAttributeNS(namespace, name, value);
      } catch {
        // Invalid name: leave this attribute and continue the batch.
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInsert(edit: Record<string, unknown>): edit is InsertEdit {
  return (
    edit.parent instanceof Node &&
    edit.node instanceof Node &&
    'reference' in edit &&
    (edit.reference === null || edit.reference instanceof Node)
  );
}

function isRemove(edit: Record<string, unknown>): edit is RemoveEdit {
  return edit.node instanceof Node && !('parent' in edit);
}

function isAttributes(edit: Record<string, unknown>): edit is AttributesEdit {
  return (
    edit.element instanceof Element &&
    (('attributes' in edit && isRecord(edit.attributes)) ||
      ('attributesNS' in edit && isRecord(edit.attributesNS)))
  );
}

function isText(edit: Record<string, unknown>): edit is TextEdit {
  return edit.element instanceof Element && typeof edit.textContent === 'string';
}
