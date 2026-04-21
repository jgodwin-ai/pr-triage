import { emojify } from "node-emoji";

// GitHub uses some shortcode aliases that node-emoji doesn't know natively.
// Map them to node-emoji keys before converting.
const GITHUB_ALIASES: Record<string, string> = {
  thumbsup: "+1",
  thumbsdown: "-1",
  thumbs_up: "+1",
  thumbs_down: "-1",
};

function applyAliases(text: string): string {
  return text.replace(/:([a-zA-Z0-9_+-]+):/g, (match, name) => {
    const alias = GITHUB_ALIASES[name];
    return alias ? `:${alias}:` : match;
  });
}

export function renderEmoji(text: string): string {
  return emojify(applyAliases(text));
}
