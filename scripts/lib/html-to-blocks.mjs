import { parse } from "node-html-parser";

/**
 * Turns the HTML WordPress hands back into the block array Strapi's `blocks`
 * field stores.
 *
 * The target is deliberately narrow: components/rich-text-renderer.tsx on the
 * front renders paragraph, heading, list, quote and image, and returns null for
 * anything else. Emitting a block type it doesn't know would import content that
 * silently fails to appear, so everything outside that set is either unwrapped
 * (div, span) or flattened into a paragraph (table cells) rather than preserved.
 */

/** Inline marks we can represent; anything else is dropped and its text kept. */
const MARKS = {
  strong: "bold",
  b: "bold",
  em: "italic",
  i: "italic",
  u: "underline",
  s: "strikethrough",
  strike: "strikethrough",
  del: "strikethrough",
};

const BLOCK_LEVEL = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "blockquote", "div", "table", "figure", "hr", "br", "img",
]);

/**
 * WordPress serves a scaled copy and a srcset of thumbnails. `src` is the one
 * the page itself used, so it is the size the author saw — the srcset entries
 * are derived from it and are not better.
 */
function imageUrl(node) {
  return node.getAttribute("src")?.trim() || null;
}

/**
 * Strapi validates every block against a schema that requires `children`, void
 * blocks included — an image with only an `image` key is rejected with
 * "body[n].children is a required field". Slate, which the editor is built on,
 * gives void nodes one empty text child; this is that.
 */
function imageBlock(url, alt) {
  return {
    type: "image",
    image: { url, alternativeText: alt?.trim() || "" },
    children: [{ type: "text", text: "" }],
  };
}

function text(value, marks) {
  const node = { type: "text", text: value };
  for (const mark of marks) node[mark] = true;
  return node;
}

/**
 * Walks inline content, carrying the marks that are open at this depth.
 *
 * Links become their own child rather than a mark, because that is how Strapi
 * stores them and how the front's renderer looks for them.
 */
function inline(node, marks = new Set(), out = []) {
  for (const child of node.childNodes) {
    // Text node.
    if (child.nodeType === 3) {
      const value = child.rawText
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ");
      if (value.trim() || out.length) out.push(text(decode(value), [...marks]));
      continue;
    }
    if (child.nodeType !== 1) continue;

    const tag = child.rawTagName?.toLowerCase();

    if (tag === "br") {
      out.push(text("\n", [...marks]));
      continue;
    }

    if (tag === "a") {
      const url = child.getAttribute("href")?.trim();
      const children = inline(child, marks, []);
      // A link with no text is a tracking pixel or a broken anchor; a link with
      // no href is just text that happens to be wrapped.
      if (!children.length) continue;
      if (!url) { out.push(...children); continue; }
      out.push({ type: "link", url, children });
      continue;
    }

    const mark = MARKS[tag];
    if (mark) {
      inline(child, new Set([...marks, mark]), out);
      continue;
    }

    // span, font, and every other inline wrapper: keep the words, drop the tag.
    inline(child, marks, out);
  }
  return out;
}

/** node-html-parser leaves entities encoded; only a handful ever show up here. */
function decode(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ");
}

/** True when a run of inline children has nothing but whitespace in it. */
function isEmpty(children) {
  return !children.some((c) =>
    c.type === "link" ? !isEmpty(c.children) : c.text.trim()
  );
}

function paragraph(children) {
  return isEmpty(children) ? null : { type: "paragraph", children };
}

/**
 * Images are pulled out of the paragraph that contained them and emitted as
 * their own block, because that is the only shape the renderer draws them in.
 * WordPress wraps nearly every image in a <p>, so without this the whole
 * migration would arrive illustrated with nothing.
 */
function extractImages(node, blocks) {
  for (const img of node.querySelectorAll("img")) {
    const url = imageUrl(img);
    if (url) {
      blocks.push(imageBlock(url, img.getAttribute("alt")))
    }
    img.remove();
  }
}

function walk(node, blocks) {
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      // Loose text between block tags — WordPress produces this around
      // shortcode output. Keep it rather than lose a sentence.
      const value = decode(child.rawText).replace(/\s+/g, " ");
      if (value.trim()) blocks.push({ type: "paragraph", children: [text(value, [])] });
      continue;
    }
    if (child.nodeType !== 1) continue;

    const tag = child.rawTagName?.toLowerCase();

    switch (tag) {
      case "p": {
        extractImages(child, blocks);
        const block = paragraph(inline(child));
        if (block) blocks.push(block);
        break;
      }

      case "h1": case "h2": case "h3":
      case "h4": case "h5": case "h6": {
        const children = inline(child);
        if (!isEmpty(children)) {
          // The renderer styles 1, 2 and "everything else" — levels below 3 are
          // kept as-is so the value stays truthful even though it draws the same.
          blocks.push({ type: "heading", level: Number(tag[1]), children });
        }
        break;
      }

      case "ul": case "ol": {
        const items = child
          .querySelectorAll(":scope > li")
          .map((li) => ({ type: "list-item", children: inline(li) }))
          .filter((item) => !isEmpty(item.children));
        if (items.length) {
          blocks.push({
            type: "list",
            format: tag === "ul" ? "unordered" : "ordered",
            children: items,
          });
        }
        break;
      }

      case "blockquote": {
        // Quotes hold paragraphs; the renderer draws a quote as one run of
        // inline content, so the paragraphs are joined rather than nested.
        const children = inline(child);
        if (!isEmpty(children)) blocks.push({ type: "quote", children });
        break;
      }

      case "img": {
        const url = imageUrl(child);
        if (url) {
          blocks.push(imageBlock(url, child.getAttribute("alt")))
        }
        break;
      }

      case "table": {
        // No table block exists. Each row becomes a paragraph of its cells,
        // which keeps the words and loses the grid — better than dropping it.
        extractImages(child, blocks);
        for (const tr of child.querySelectorAll("tr")) {
          const cells = tr
            .querySelectorAll("td, th")
            .map((cell) => decode(cell.text).replace(/\s+/g, " ").trim())
            .filter(Boolean);
          if (cells.length) {
            blocks.push({ type: "paragraph", children: [text(cells.join(" — "), [])] });
          }
        }
        break;
      }

      // Structural wrappers Avada leaves behind, plus anything we have no block
      // for: descend and keep whatever is inside.
      case "hr":
      case "script": case "style": case "iframe": case "noscript":
        break;

      default:
        if (BLOCK_LEVEL.has(tag) || child.querySelector("p,div,ul,ol,h1,h2,h3,h4,table,img")) {
          walk(child, blocks);
        } else {
          const block = paragraph(inline(child));
          if (block) blocks.push(block);
        }
    }
  }
  return blocks;
}

/** Collapses the runs of empty paragraphs WordPress leaves between shortcodes. */
function tidy(blocks) {
  return blocks.filter((block, i) => {
    if (block.type !== "paragraph") return true;
    const value = block.children.map((c) => c.text ?? "").join("").trim();
    if (value) return true;
    // Drop an empty paragraph unless it separates two images, where it is the
    // only thing keeping them from colliding.
    return blocks[i - 1]?.type === "image" && blocks[i + 1]?.type === "image";
  });
}

export function htmlToBlocks(html) {
  if (!html?.trim()) return [];
  return tidy(walk(parse(html, { blockTextElements: {} }), []));
}

/** Plain text of a block array — used for summaries and read-time. */
export function blocksToText(blocks) {
  const parts = [];
  const visit = (children) => {
    for (const child of children ?? []) {
      if (child.type === "link") visit(child.children);
      else if (child.type === "list-item") visit(child.children);
      else if (typeof child.text === "string") parts.push(child.text);
    }
  };
  for (const block of blocks) {
    if (block.type === "image") continue;
    visit(block.children);
    parts.push("\n");
  }
  return parts.join("").replace(/[ \t]+/g, " ").trim();
}
