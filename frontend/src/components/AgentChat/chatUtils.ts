/* =========================================================
   AGENT CHAT — SHARED HELPERS
   ---------------------------------------------------------
   Storage, history shaping, image handling and backend
   response parsing. Shared by all six agent pages so their
   behaviour cannot drift apart.
   ========================================================= */

import type { CareerProfileData } from "../../services/api";

import type {
  ChatSession,
  Message,
  MessageAttachment,
} from "./types";

/*
 * The UI keeps the whole conversation, but only a bounded window
 * is ever sent back to the model. These mirror the backend's token
 * budget in backend/main.py, so the frontend does not spend
 * bandwidth on history the backend would trim off anyway.
 */
export const MAX_BACKEND_HISTORY_MESSAGES = 8;
export const MAX_BACKEND_HISTORY_CHARS = 6000;
export const MAX_HISTORY_MESSAGE_CHARS = 2000;

export const CAREER_PROFILE_KEY = "agentverse-career-profile";

/* Images are resized before upload so requests stay small. */
export const MAX_IMAGE_DIMENSION = 1600;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;


/* =========================================================
   IDS
   ========================================================= */

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function createChatId(): string {
  return createId("chat");
}

export function createMessageId(): string {
  return createId("message");
}


/* =========================================================
   TITLES AND ORDERING
   ========================================================= */

export function getChatTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(
    (message) => message.sender === "user"
  );

  if (!firstUserMessage) {
    return "New chat";
  }

  const text = firstUserMessage.text.trim();

  if (text) {
    return text.length > 40
      ? `${text.slice(0, 40)}...`
      : text;
  }

  if (firstUserMessage.attachment) {
    return firstUserMessage.attachment.name;
  }

  return "New chat";
}

export function sortChats(chats: ChatSession[]): ChatSession[] {
  return [...chats].sort((a, b) => {
    if (a.pinned && !b.pinned) {
      return -1;
    }

    if (!a.pinned && b.pinned) {
      return 1;
    }

    return (
      (b.updatedAt || b.createdAt) -
      (a.updatedAt || a.createdAt)
    );
  });
}


/* =========================================================
   STORED HISTORY
   ========================================================= */

function normalizeAttachment(
  value: unknown
): MessageAttachment | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Record<string, unknown>;

  return {
    name:
      typeof source.name === "string"
        ? source.name
        : "Attachment",

    type:
      typeof source.type === "string"
        ? source.type
        : "application/octet-stream",

    dataUrl:
      typeof source.dataUrl === "string"
        ? source.dataUrl
        : undefined,
  };
}

function normalizeMessage(value: unknown): Message {
  const source = (value || {}) as Record<string, unknown>;

  return {
    id:
      typeof source.id === "string"
        ? source.id
        : createMessageId(),

    text: typeof source.text === "string" ? source.text : "",

    sender: source.sender === "user" ? "user" : "ai",

    attachment: normalizeAttachment(source.attachment),

    isError: Boolean(source.isError),
  };
}


export function normalizeHistory(data: unknown): ChatSession[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const source = item as Record<string, unknown>;

      const messages = Array.isArray(source.messages)
        ? source.messages.map(normalizeMessage)
        : [];

      const createdAt =
        typeof source.createdAt === "number"
          ? source.createdAt
          : Date.now();

      return {
        id:
          typeof source.id === "string"
            ? source.id
            : createChatId(),

        title:
          typeof source.title === "string"
            ? source.title
            : getChatTitle(messages),

        messages,

        createdAt,

        updatedAt:
          typeof source.updatedAt === "number"
            ? source.updatedAt
            : createdAt,

        pinned: Boolean(source.pinned),
      };
    });
}


export function loadHistory(storageKey: string): ChatSession[] {
  try {
    const saved = localStorage.getItem(storageKey);

    if (!saved) {
      return [];
    }

    return sortChats(normalizeHistory(JSON.parse(saved)));
  } catch (error) {
    console.error("Chat history could not be read:", error);

    return [];
  }
}

/* Drops base64 image data but keeps the attachment's name. */
function withoutAttachmentData(chat: ChatSession): ChatSession {
  return {
    ...chat,
    messages: chat.messages.map((message) =>
      message.attachment?.dataUrl
        ? {
          ...message,
          attachment: {
            name: message.attachment.name,
            type: message.attachment.type,
          },
        }
        : message
    ),
  };
}

/*
 * Base64 images are what normally fills the 5 MB localStorage
 * quota. If the write fails, retry once without image data so
 * the conversation text still survives a refresh.
 */
export function saveHistory(
  storageKey: string,
  chats: ChatSession[]
): void {
  if (chats.length === 0) {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* Nothing useful to do if storage is unavailable. */
    }

    return;
  }

  const ordered = sortChats(chats);

  try {
    localStorage.setItem(storageKey, JSON.stringify(ordered));
  } catch {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(ordered.map(withoutAttachmentData))
      );
    } catch (retryError) {
      console.error(
        "Chat history could not be saved:",
        retryError
      );
    }
  }
}


/* =========================================================
   BACKEND HISTORY
   ========================================================= */

export type BackendHistoryItem = {
  id: string;
  text: string;
  sender: "user" | "ai";
  attachment?: {
    name: string;
    type: string;
  };
};

/*
 * Walks backwards so the newest turns are always kept, and
 * skips error bubbles so a past failure never becomes part of
 * the model's context.
 */
export function buildBackendHistory(
  source: Message[]
): BackendHistoryItem[] {
  const compact: BackendHistoryItem[] = [];

  let totalChars = 0;

  for (
    let index = source.length - 1;
    index >= 0 &&
    compact.length < MAX_BACKEND_HISTORY_MESSAGES;
    index--
  ) {
    const message = source[index];

    if (message.isError) {
      continue;
    }

    const originalText = String(message.text || "").trim();

    if (!originalText && !message.attachment) {
      continue;
    }

    const text = originalText.slice(
      0,
      MAX_HISTORY_MESSAGE_CHARS
    );

    const attachment = message.attachment
      ? {
        name: message.attachment.name,
        type: message.attachment.type,
      }
      : undefined;

    const itemChars =
      text.length + (attachment?.name.length || 0) + 80;

    if (
      compact.length > 0 &&
      totalChars + itemChars > MAX_BACKEND_HISTORY_CHARS
    ) {
      break;
    }

    compact.unshift({
      id: message.id,
      text,
      sender: message.sender,
      attachment,
    });

    totalChars += itemChars;
  }

  return compact;
}


/* =========================================================
   CAREER PROFILE
   ---------------------------------------------------------
   Written by the Career Profile form and read by TailorAI so
   its answers stay personalised.
   ========================================================= */

export type { CareerProfileData };

export function getCareerProfile(): CareerProfileData | null {
  try {
    const saved = localStorage.getItem(CAREER_PROFILE_KEY);

    if (!saved) {
      return null;
    }

    const parsed = JSON.parse(saved);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const read = (key: keyof CareerProfileData): string =>
      typeof parsed[key] === "string"
        ? String(parsed[key]).trim()
        : "";
    const profile: CareerProfileData = {
      skills: read("skills"),
      targetRole: read("targetRole"),
      experience: read("experience"),
      timeline: read("timeline"),
      salaryGoal: read("salaryGoal"),
    };

    const hasAnyValue = Object.values(profile).some(Boolean);

    return hasAnyValue ? profile : null;
  } catch {
    return null;
  }
}


/* =========================================================
   FILES AND IMAGES
   ========================================================= */

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));

    reader.onerror = () =>
      reject(new Error("Could not read that file."));

    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


/*
 * Pulls an image out of a paste. A screenshot arrives as a
 * clipboardData.items entry with kind "file"; a copied image file
 * arrives in clipboardData.files. Both are checked, and a
 * zero-byte entry is ignored so an empty attachment is never
 * created. Returns null for a text-only clipboard, which is the
 * signal to leave the paste alone.
 */
export function extractImageFromClipboard(
  data: DataTransfer | null
): File | null {
  if (!data) {
    return null;
  }

  for (const item of Array.from(data.items || [])) {
    if (
      item.kind === "file" &&
      item.type.startsWith("image/")
    ) {
      const file = item.getAsFile();

      if (file && file.size > 0) {
        return file;
      }
    }
  }

  for (const file of Array.from(data.files || [])) {
    if (file.type.startsWith("image/") && file.size > 0) {
      return file;
    }
  }

  return null;
}


/*
 * Downscales large photos before upload. Anything that is not
 * an image, or that cannot be decoded, is returned untouched
 * so the caller never loses the user's file.
 */
export async function resizeImage(
  file: File
): Promise<{ file: File; dataUrl: string }> {
  if (!file.type.startsWith("image/")) {
    return {
      file,
      dataUrl: await fileToDataUrl(file),
    };
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>(
      (resolve, reject) => {
        const element = new Image();

        element.onload = () => resolve(element);

        element.onerror = () =>
          reject(new Error("Could not load that image."));

        element.src = sourceUrl;
      }
    );

    let width = image.width;
    let height = image.height;

    if (
      width > MAX_IMAGE_DIMENSION ||
      height > MAX_IMAGE_DIMENSION
    ) {
      const ratio = Math.min(
        MAX_IMAGE_DIMENSION / width,
        MAX_IMAGE_DIMENSION / height
      );

      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not process that image.");
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );

    if (!blob) {
      throw new Error("Could not compress that image.");
    }

    const processedFile = new File(
      [blob],
      file.name.replace(/\.[^/.]+$/, ".jpg"),
      {
        type: "image/jpeg",
        lastModified: Date.now(),
      }
    );

    return {
      file: processedFile,
      dataUrl: await fileToDataUrl(processedFile),
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}


/* =========================================================
   RESPONSE PARSING
   ---------------------------------------------------------
   /study-ai answers quizzes with a structured payload that
   has no "reply" field, so it is rendered into markdown here
   instead of falling through as an empty response.
   ========================================================= */

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function formatQuizQuestion(data: UnknownRecord): string {
  const lines: string[] = [];

  const number = asNumber(data.question_number) ?? 1;
  const total = asNumber(data.total_questions) ?? 5;

  lines.push(`**Question ${number} of ${total}**`);

  const question = asString(data.question);

  if (question) {
    lines.push("", question);
  }

  const options = (data.options || {}) as UnknownRecord;

  const renderedOptions = OPTION_KEYS.filter((key) =>
    asString(options[key])
  ).map((key) => `- **${key}.** ${asString(options[key])}`);

  if (renderedOptions.length > 0) {
    lines.push("", ...renderedOptions);
  }

  lines.push("", "_Reply with A, B, C or D._");

  return lines.join("\n");
}


function formatQuizFeedback(data: UnknownRecord): string {
  const lines: string[] = [];

  const feedbackNumber = asNumber(
    data.feedback_question_number
  );

  const label = feedbackNumber
    ? `Question ${feedbackNumber}`
    : "Your answer";

  const isCorrect = Boolean(data.correct);

  lines.push(
    isCorrect
      ? `**${label}: correct.**`
      : `**${label}: incorrect.**`
  );

  const selected = asString(data.selected_answer);
  const answer = asString(data.correct_answer);

  if (!isCorrect && selected && answer) {
    lines.push(
      `You chose **${selected}**. The correct answer is **${answer}**.`
    );
  } else if (selected) {
    lines.push(`You chose **${selected}**.`);
  }

  const explanation = asString(data.explanation);

  if (explanation) {
    lines.push("", `> ${explanation}`);
  }

  const score = asNumber(data.score);

  if (score !== null) {
    lines.push("", `Score so far: **${score}**`);
  }

  lines.push("", "---", "", formatQuizQuestion(data));

  return lines.join("\n");
}


function formatQuizResults(data: UnknownRecord): string {
  const lines: string[] = ["**Quiz complete**"];

  const score = asNumber(data.score);
  const total = asNumber(data.total) ?? 5;
  const percentage = asNumber(data.percentage);

  if (score !== null) {
    lines.push(
      "",
      percentage !== null
        ? `Score: **${score} / ${total}** (${percentage}%)`
        : `Score: **${score} / ${total}**`
    );
  }

  const results = Array.isArray(data.results)
    ? (data.results as UnknownRecord[])
    : [];

  if (results.length > 0) {
    lines.push("", "| Question | Result |", "| --- | --- |");

    results.forEach((item) => {
      lines.push(
        `| ${asNumber(item.question) ?? ""} | ${asString(item.status) || ""} |`
      );
    });
  }

  const incorrect = Array.isArray(data.incorrect_answers)
    ? (data.incorrect_answers as UnknownRecord[])
    : [];

  if (incorrect.length > 0) {
    lines.push("", "**Review**");

    incorrect.forEach((item) => {
      const number = asNumber(item.question);
      const selected = asString(item.selected);
      const correct = asString(item.correct);
      const explanation = asString(item.explanation);

      lines.push(
        "",
        `**Question ${number ?? ""}** — you chose **${selected}**, the correct answer is **${correct}**.`
      );

      if (explanation) {
        lines.push(`> ${explanation}`);
      }
    });
  }

  return lines.join("\n");
}


function formatQuizPayload(data: UnknownRecord): string | null {
  const type = asString(data.type);

  if (type !== "quiz" && type !== "quiz_setup") {
    return null;
  }

  const status = asString(data.status);

  if (
    status === "waiting_for_topic" ||
    status === "waiting_for_answer"
  ) {
    return (
      asString(data.message) ||
      "Please reply with A, B, C or D."
    );
  }

  if (status === "active") {
    const topic = asString(data.topic);

    return topic
      ? `**Quiz: ${topic}**\n\n${formatQuizQuestion(data)}`
      : formatQuizQuestion(data);
  }

  if (status === "answer_received") {
    return formatQuizFeedback(data);
  }

  if (status === "complete") {
    return formatQuizResults(data);
  }

  return null;
}

/*
 * Reads the assistant's text out of any backend shape:
 * quizzes first, then the various reply field names used by
 * the different endpoints.
 */
export function extractReply(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "";
  }

  const record = data as UnknownRecord;

  const quiz = formatQuizPayload(record);

  if (quiz) {
    return quiz;
  }

  for (const key of [
    "reply",
    "response",
    "message",
    "answer",
  ]) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

export function isTruncated(data: unknown): boolean {
  return Boolean(
    data &&
    typeof data === "object" &&
    (data as UnknownRecord).truncated
  );
}
