import Link from "next/link";

const CLASS_USER = "font-semibold text-purple-600 dark:text-purple-300";
const CLASS_CHANNEL = "font-semibold text-indigo-600 dark:text-indigo-300";

const MENTION_PATTERN = /([@#])([a-zA-Z0-9_\-]+)/g;

const buildMentionKey = (mention) => {
  const value = mention.value?.toLowerCase?.() ?? mention.value;
  return `${mention.type}:${value}`;
};

export const extractMentions = (text) => {
  if (typeof text !== "string" || !text.length) return [];

  const mentions = [];
  let match;
  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    const [, prefix, rawValue] = match;
    mentions.push({
      type: prefix === "#" ? "channel" : "user",
      value: rawValue,
    });
  }
  return mentions;
};

export const renderMessageWithMentions = (text, mentions = [], options = {}) => {
  if (!text) return text;

  const { resolveMention, onMentionClick } = options;

  const mentionMap = new Map();
  mentions.forEach((mention) => {
    if (!mention?.type || !mention?.value) return;
    mentionMap.set(buildMentionKey(mention), mention);
  });

  const getMentionData = (mentionType, value) => {
    const key = buildMentionKey({ type: mentionType, value });
    if (mentionMap.has(key)) {
      return mentionMap.get(key);
    }
    if (typeof resolveMention === "function") {
      const resolved = resolveMention({ type: mentionType, value });
      if (resolved) {
        mentionMap.set(key, resolved);
        return resolved;
      }
    }
    return null;
  };

  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    const [fullMatch, prefix, rawValue] = match;
    const startIndex = match.index;

    if (startIndex > lastIndex) {
      elements.push(text.slice(lastIndex, startIndex));
    }

    const mentionType = prefix === "#" ? "channel" : "user";
    const mentionData = getMentionData(mentionType, rawValue);
    const displayText = `${prefix}${rawValue}`;
    const className = mentionType === "channel" ? CLASS_CHANNEL : CLASS_USER;
    const key = buildMentionKey({ type: mentionType, value: rawValue });

    const handleClick =
      mentionData && typeof onMentionClick === "function"
        ? (event) => {
            event.preventDefault();
            onMentionClick(mentionData);
          }
        : null;

    if (handleClick) {
      elements.push(
        <button
          key={`${key}-${startIndex}`}
          type="button"
          className={`${className} underline decoration-current decoration-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400`}
          onClick={handleClick}
          style={{ background: "none", border: "none", padding: 0 }}
        >
          {displayText}
        </button>
      );
    } else if (mentionData?.link && !options?.compact) {
      elements.push(
        <Link key={`${key}-${startIndex}`} href={mentionData.link} className={className}>
          {displayText}
        </Link>
      );
    } else {
      elements.push(
        <span key={`${key}-${startIndex}`} className={className}>
          {displayText}
        </span>
      );
    }

    lastIndex = startIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
};

export default renderMessageWithMentions;

