import { css } from 'lit';

import { find, identity } from '@openenergytools/scl-lib';

export function updateElementReference(
  newDoc: XMLDocument,
  oldElement: Element
): Element | null {
  if (!oldElement || !oldElement.closest('SCL')) return null;

  const id = identity(oldElement);

  const newElement = find(newDoc, oldElement.tagName, id);

  return newElement;
}

export function pathIdentity(element: Element): string {
  // A removed control is still on the closed dialog. identity needs a parent.
  if (!element.parentElement) return '';
  const id = identity(element);
  if (Number.isNaN(id)) return 'UNDEFINED';

  const paths = (id as string).split('>');
  paths.pop();
  return paths.join('>');
}

export const styles = css`
  .section {
    display: flex;
    min-height: 0;
    overlay: auto;
    height: 100%;
  }

  .selectionlist {
    flex: 50%;
    background-color: var(--oscd-plugin-internal-base3);
    overflow: hidden;
  }

  .elementeditorcontainer {
    flex: 50%;
    background-color: var(--oscd-plugin-internal-base3);
    overflow-y: auto;
    display: flex;
    z-index: 0;
    border-left: 1px solid var(--oscd-plugin-internal-base2);
  }

  .listitem.header {
    font-weight: 500;
  }

  mwc-list-item.hidden[noninteractive] + li[divider] {
    display: none;
  }

  mwc-list-item.hidden[slot] + li[divider] {
    display: none;
  }

  .change.scl.element {
    display: none;
  }

  @media (max-width: 950px) {
    .elementeditorcontainer {
      display: block;
    }
  }

  @media (max-width: 599px) {
    .section {
      position: relative;
    }

    .selectionlist {
      position: absolute;
      width: calc(100% - 32px);
      top: 8px;
      max-height: calc(100% - 16px);
      left: 8px;
      z-index: 1;
      box-shadow:
        0 8px 10px 1px
          color-mix(in srgb, var(--oscd-plugin-internal-base03) 14%, transparent),
        0 3px 14px 2px
          color-mix(in srgb, var(--oscd-plugin-internal-base03) 12%, transparent),
        0 5px 5px -3px
          color-mix(in srgb, var(--oscd-plugin-internal-base03) 20%, transparent);
    }

    .elementeditorcontainer {
      display: block;
      border-left: 0;
    }

    data-set-element-editor {
      width: calc(100% - 16px);
    }

    .selectionlist.hidden {
      display: none;
    }

    .change.scl.element {
      display: flex;
      margin: 4px 8px 8px;
    }
  }
`;
