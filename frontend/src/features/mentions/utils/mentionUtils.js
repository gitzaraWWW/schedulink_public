export function getActiveMentionQuery(text) {
  const match = text.match(/(?:^|\s)@([^\s@]*)$/);

  return match ? match[1] : null;
}

export function replaceActiveMention(text, replacement) {
  return text.replace(/(^|\s)@[^\s@]*$/, `$1@${replacement} `);
}

export function tokenizeMentionText(text) {
  const value = String(text || "");

  if (!value) {
    return [];
  }

  const tokens = [];
  const mentionRegex = /(^|\s)(@[^\s@]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(value)) !== null) {
    const [fullMatch, leadingSpace, mention] = match;
    const matchStart = match.index;

    if (matchStart > lastIndex) {
      tokens.push({
        type: "text",
        value: value.slice(lastIndex, matchStart),
      });
    }

    if (leadingSpace) {
      tokens.push({
        type: "text",
        value: leadingSpace,
      });
    }

    tokens.push({
      type: "mention",
      value: mention,
    });

    lastIndex = matchStart + fullMatch.length;
  }

  if (lastIndex < value.length) {
    tokens.push({
      type: "text",
      value: value.slice(lastIndex),
    });
  }

  return tokens;
}
