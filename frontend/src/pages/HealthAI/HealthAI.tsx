import "./healthAI.css";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import Footer from "../../components/Footer/Footer";


/* =========================================================
   TYPES
   ========================================================= */

type MessageAttachment = {
  name: string;
  type: string;
  dataUrl?: string;
};

type Message = {
  id: string;
  text: string;
  sender: "user" | "ai";
  attachment?: MessageAttachment;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
};

/* =========================================================
   STORAGE
   ========================================================= */

const CHAT_HISTORY_KEY =
  "agentverse-health-chat-history-v2";


/* =========================================================
   BACKEND
   ========================================================= */

const BACKEND_URL =
  "http://127.0.0.1:8000/health-ai";

/*
 * Keep the browser UI history unlimited, but never send the whole chat
 * back to the model. This prevents long conversations from becoming
 * oversized requests while preserving enough recent context.
 */
const MAX_BACKEND_HISTORY_MESSAGES = 10;
const MAX_BACKEND_HISTORY_CHARS = 9000;
const MAX_HISTORY_MESSAGE_CHARS = 2000;
const REQUEST_TIMEOUT_MS = 90000;

function buildBackendHistory(
  source: Message[]
): Array<{
  id: string;
  text: string;
  sender: "user" | "ai";
  attachment?: {
    name: string;
    type: string;
  };
}> {
  const compact: Array<{
    id: string;
    text: string;
    sender: "user" | "ai";
    attachment?: {
      name: string;
      type: string;
    };
  }> = [];

  let totalChars = 0;

  // Work backwards so the newest context is always retained.
  for (
    let index = source.length - 1;
    index >= 0 &&
    compact.length < MAX_BACKEND_HISTORY_MESSAGES;
    index--
  ) {
    const message = source[index];

    const originalText = String(message.text || "").trim();
    if (!originalText && !message.attachment) {
      continue;
    }

    const text = originalText.slice(
      0,
      MAX_HISTORY_MESSAGE_CHARS
    );

    const item = {
      id: message.id,
      text,
      sender: message.sender,
      attachment: message.attachment
        ? {
          name: message.attachment.name,
          type: message.attachment.type,
        }
        : undefined,
    };

    const itemChars =
      text.length +
      (item.attachment?.name.length || 0) +
      80;

    if (
      totalChars + itemChars >
      MAX_BACKEND_HISTORY_CHARS
    ) {
      break;
    }

    compact.unshift(item);
    totalChars += itemChars;
  }

  return compact;
}


/* =========================================================
   ID HELPERS
   ========================================================= */

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function createChatId(): string {
  return createId("chat");
}

function createMessageId(): string {
  return createId("message");
}


/* =========================================================
   MARKDOWN
   ========================================================= */

function cleanMarkdown(text: string): string {
  return text || "";
}


/* =========================================================
   CHAT TITLE
   ========================================================= */

function getChatTitle(
  messages: Message[]
): string {
  const firstUserMessage =
    messages.find(
      (message) =>
        message.sender === "user"
    );

  if (!firstUserMessage) {
    return "New chat";
  }

  const text =
    firstUserMessage.text.trim();

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


/* =========================================================
   SORT CHATS
   ========================================================= */

function sortChats(
  chats: ChatSession[]
): ChatSession[] {
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
   FILE TO DATA URL
   ========================================================= */

function fileToDataUrl(
  file: File
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        resolve(
          String(reader.result)
        );
      };

      reader.onerror = () => {
        reject(
          new Error(
            "Could not read file."
          )
        );
      };

      reader.readAsDataURL(file);
    }
  );
}


/* =========================================================
   RESIZE IMAGE
   ========================================================= */

async function resizeImage(
  file: File
): Promise<{
  file: File;
  dataUrl: string;
}> {
  if (!file.type.startsWith("image/")) {
    const dataUrl =
      await fileToDataUrl(file);

    return {
      file,
      dataUrl,
    };
  }

  const sourceUrl =
    URL.createObjectURL(file);

  try {
    const image =
      await new Promise<HTMLImageElement>(
        (resolve, reject) => {
          const img =
            new Image();

          img.onload = () =>
            resolve(img);

          img.onerror = () =>
            reject(
              new Error(
                "Could not load image."
              )
            );

          img.src = sourceUrl;
        }
      );

    const MAX_SIZE = 1600;

    let width = image.width;
    let height = image.height;

    if (
      width > MAX_SIZE ||
      height > MAX_SIZE
    ) {
      const ratio =
        Math.min(
          MAX_SIZE / width,
          MAX_SIZE / height
        );

      width =
        Math.round(width * ratio);

      height =
        Math.round(height * ratio);
    }

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width = width;
    canvas.height = height;

    const context =
      canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Could not process image."
      );
    }

    context.drawImage(
      image,
      0,
      0,
      width,
      height
    );

    const blob =
      await new Promise<Blob | null>(
        (resolve) =>
          canvas.toBlob(
            resolve,
            "image/jpeg",
            0.9
          )
      );

    if (!blob) {
      throw new Error(
        "Could not compress image."
      );
    }

    const processedFile =
      new File(
        [blob],
        file.name.replace(
          /\.[^/.]+$/,
          ".jpg"
        ),
        {
          type: "image/jpeg",
          lastModified:
            Date.now(),
        }
      );

    const dataUrl =
      await fileToDataUrl(
        processedFile
      );

    return {
      file: processedFile,
      dataUrl,
    };
  } finally {
    URL.revokeObjectURL(
      sourceUrl
    );
  }
}


/* =========================================================
   NORMALIZE HISTORY
   ========================================================= */

function normalizeHistory(
  data: unknown
): ChatSession[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter(
      (item) =>
        item &&
        typeof item === "object"
    )
    .map((item: any) => {
      const messages: Message[] =
        Array.isArray(item.messages)
          ? item.messages.map(
            (message: any) => ({
              id:
                typeof message.id ===
                  "string"
                  ? message.id
                  : createMessageId(),

              text:
                typeof message.text ===
                  "string"
                  ? message.text
                  : "",

              sender:
                message.sender ===
                  "user"
                  ? "user"
                  : "ai",

              attachment:
                message.attachment
                  ? {
                    name:
                      message
                        .attachment
                        .name ||
                      "Attachment",

                    type:
                      message
                        .attachment
                        .type ||
                      "application/octet-stream",

                    dataUrl:
                      message
                        .attachment
                        .dataUrl,
                  }
                  : undefined,
            }
            )
          )
          : [];

      const createdAt =
        typeof item.createdAt ===
          "number"
          ? item.createdAt
          : Date.now();

      const updatedAt =
        typeof item.updatedAt ===
          "number"
          ? item.updatedAt
          : createdAt;

      return {
        id:
          typeof item.id ===
            "string"
            ? item.id
            : createChatId(),

        title:
          typeof item.title ===
            "string"
            ? item.title
            : getChatTitle(messages),

        messages,

        createdAt,

        updatedAt,

        pinned:
          Boolean(item.pinned),
      };
    });
}


/* =========================================================
   ICONS
   ========================================================= */

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="11"
        cy="11"
        r="7"
      />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}


function CollapseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
      />
      <path d="M9 4v16" />
      <path d="m6 9 2 3-2 3" />
    </svg>
  );
}


function ExpandIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
      />
      <path d="M9 4v16" />
      <path d="m12 9 2 3-2 3" />
    </svg>
  );
}


function PinIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 17v5" />
      <path d="m9 3 6 0" />
      <path d="M9 3v5l-4 4h14l-4-4V3" />
    </svg>
  );
}


function MoreIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}


function ShareIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 13v6h14v-6" />
    </svg>
  );
}


function CopyMessageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function EditMessageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3Z" />
      <path d="m13.5 7.5 3 3" />
    </svg>
  );
}


function RenameIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" />
      <path d="m13.5 6.5 3.5 3.5" />
    </svg>
  );
}


function ArchiveIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2"
      />
      <path d="M4 9h16" />
      <path d="M9 13h6" />
    </svg>
  );
}


function TrashIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}


/* =========================================================
   TAILOR AI
   ========================================================= */

function HealthAI() {

  /* =======================================================
     STATE
     ======================================================= */

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [input, setInput] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [chatHistory, setChatHistory] =
    useState<ChatSession[]>([]);

  const [activeChatId, setActiveChatId] =
    useState<string | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [imagePreview, setImagePreview] =
    useState<string | null>(null);

  const [copiedCode, setCopiedCode] =
    useState("");

  const [activeUserMessageId, setActiveUserMessageId] =
    useState<string | null>(null);

  const [messageActionStatus, setMessageActionStatus] =
    useState<string | null>(null);

  /* NEW */
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [openMenuId, setOpenMenuId] =
    useState<string | null>(null);

  const messagesRef =
    useRef<HTMLDivElement>(null);
  const lastScrolledMessageIdRef = useRef<string | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const searchInputRef =
    useRef<HTMLInputElement>(null);

  const composerInputRef =
    useRef<HTMLInputElement>(null);

  const activeChatIdRef =
    useRef<string | null>(null);


  /* =======================================================
     ACTIVE CHAT REF
     ======================================================= */

  useEffect(() => {
    activeChatIdRef.current =
      activeChatId;
  }, [activeChatId]);


  /* =======================================================
     LOAD HISTORY
     ======================================================= */

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          CHAT_HISTORY_KEY
        );

      if (!saved) {
        return;
      }

      const parsed =
        JSON.parse(saved);

      const history =
        sortChats(
          normalizeHistory(parsed)
        );

      setChatHistory(history);

      if (history.length > 0) {
        const first =
          history[0];

        setActiveChatId(
          first.id
        );

        activeChatIdRef.current =
          first.id;

        setMessages(
          first.messages
        );
      }
    } catch (error) {
      // History loading does not use a request timeout.
      if (error instanceof DOMException && error.name === "AbortError") {
        error = new Error(
          "HealthAI took too long to respond. Please try again with a shorter question."
        );
      }

      console.error(
        "HealthAI history load failed:",
        error
      );
    }
  }, []);


  /* =======================================================
     SAVE HISTORY
     ======================================================= */

  useEffect(() => {
    try {
      if (chatHistory.length === 0) {
        localStorage.removeItem(
          CHAT_HISTORY_KEY
        );

        return;
      }

      localStorage.setItem(
        CHAT_HISTORY_KEY,
        JSON.stringify(
          sortChats(chatHistory)
        )
      );
    } catch (error) {
      console.error(
        "HealthAI history save failed:",
        error
      );
    }
  }, [chatHistory]);


  /* =======================================================
     AUTO FOCUS SEARCH
     ======================================================= */

  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [searchOpen]);


  /* =======================================================
     GLOBAL CHAT INPUT
     -------------------------------------------------------
     Like ChatGPT, a user can start typing even when the
     composer is not currently focused.
     ======================================================= */

  useEffect(() => {
    function handleGlobalKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing
      ) {
        return;
      }

      const target =
        event.target as HTMLElement | null;

      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "BUTTON" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (
        event.key.length === 1 &&
        !loading
      ) {
        composerInputRef.current?.focus();
      }
    }

    window.addEventListener(
      "keydown",
      handleGlobalKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleGlobalKeyDown
      );
    };
  }, [loading]);


  /* =======================================================
     MESSAGE POSITIONING
     -------------------------------------------------------
     Do not jump to the absolute bottom of a long answer.
     When a new message arrives, place the beginning of that
     message near the top of the viewport so the user can read
     the answer from the beginning and scroll naturally.
     ======================================================= */

  useEffect(() => {
    const element = messagesRef.current;

    if (!element || messages.length === 0) {
      return;
    }

    const lastMessage =
      messages[messages.length - 1];

    // Prevent scrolling to the same message twice
    if (lastScrolledMessageIdRef.current === lastMessage.id) {
      return;
    }
    lastScrolledMessageIdRef.current = lastMessage.id;

    // Find the newest message element
    const newestMessage =
      element.querySelector(
        ".conversation .message-row:last-of-type"
      ) as HTMLElement | null;

    if (!newestMessage) {
      return;
    }

    // Use single requestAnimationFrame to avoid layout thrashing
    requestAnimationFrame(() => {
      newestMessage.scrollIntoView({
        block: "start",
        behavior: "auto",
      });
    });
  }, [messages.length]);


  /* =======================================================
     UPDATE CHAT
     ======================================================= */

  function updateChat(
    chatId: string,
    nextMessages: Message[]
  ) {
    setChatHistory(
      (previous) => {
        const existing =
          previous.find(
            (chat) =>
              chat.id === chatId
          );

        if (existing) {
          return sortChats(
            previous.map(
              (chat) =>
                chat.id === chatId
                  ? {
                    ...chat,

                    title:
                      getChatTitle(
                        nextMessages
                      ),

                    messages:
                      nextMessages,

                    updatedAt:
                      Date.now(),
                  }
                  : chat
            )
          );
        }

        const newChat: ChatSession =
        {
          id: chatId,

          title:
            getChatTitle(
              nextMessages
            ),

          messages:
            nextMessages,

          createdAt:
            Date.now(),

          updatedAt:
            Date.now(),

          pinned: false,
        };

        return sortChats([
          newChat,
          ...previous,
        ]);
      }
    );
  }


  /* =======================================================
     NEW CHAT
     ======================================================= */

  function handleNewChat() {
    if (loading) {
      return;
    }

    const id =
      createChatId();

    setActiveChatId(id);

    activeChatIdRef.current =
      id;

    setMessages([]);

    setInput("");

    setSearchQuery("");

    setOpenMenuId(null);

    removeSelectedFile();
  }


  /* =======================================================
     OPEN CHAT
     ======================================================= */

  function handleOpenChat(
    chat: ChatSession
  ) {
    if (loading) {
      return;
    }

    setActiveChatId(chat.id);

    activeChatIdRef.current =
      chat.id;

    setMessages(
      chat.messages || []
    );

    setInput("");

    setOpenMenuId(null);

    removeSelectedFile();
  }


  /* =======================================================
     PIN CHAT
     ======================================================= */

  function handlePinChat(
    event: React.MouseEvent,
    chatId: string
  ) {
    event.stopPropagation();

    if (loading) {
      return;
    }

    setChatHistory(
      (previous) =>
        sortChats(
          previous.map(
            (chat) =>
              chat.id === chatId
                ? {
                  ...chat,
                  pinned:
                    !chat.pinned,
                  updatedAt:
                    Date.now(),
                }
                : chat
          )
        )
    );

    setOpenMenuId(null);
  }


  /* =======================================================
     DELETE CHAT
     ======================================================= */

  function handleDeleteChat(
    event: React.MouseEvent,
    chatId: string
  ) {
    event.stopPropagation();

    if (loading) {
      return;
    }

    setChatHistory(
      (previous) =>
        previous.filter(
          (chat) =>
            chat.id !== chatId
        )
    );

    if (
      activeChatIdRef.current ===
      chatId
    ) {
      const newId =
        createChatId();

      setActiveChatId(newId);

      activeChatIdRef.current =
        newId;

      setMessages([]);
    }

    setOpenMenuId(null);
  }


  /* =======================================================
     RENAME CHAT
     ======================================================= */

  function handleRenameChat(
    event: React.MouseEvent,
    chat: ChatSession
  ) {
    event.stopPropagation();

    if (loading) {
      return;
    }

    const newTitle =
      window.prompt(
        "Rename chat",
        chat.title
      );

    if (
      newTitle === null ||
      !newTitle.trim()
    ) {
      setOpenMenuId(null);
      return;
    }

    setChatHistory(
      (previous) =>
        previous.map(
          (item) =>
            item.id === chat.id
              ? {
                ...item,
                title:
                  newTitle.trim(),
                updatedAt:
                  Date.now(),
              }
              : item
        )
    );

    setOpenMenuId(null);
  }


  /* =======================================================
     CLEAR CURRENT CHAT
     ======================================================= */

  function handleClearChat() {
    if (loading) {
      return;
    }

    const current =
      activeChatIdRef.current;

    if (current) {
      setChatHistory(
        (previous) =>
          previous.filter(
            (chat) =>
              chat.id !== current
          )
      );
    }

    const newId =
      createChatId();

    setActiveChatId(newId);

    activeChatIdRef.current =
      newId;

    setMessages([]);

    setInput("");

    setOpenMenuId(null);

    removeSelectedFile();
  }


  /* =======================================================
     SEARCH
     ======================================================= */

  function toggleSearch() {
    setSearchOpen(
      (previous) => !previous
    );

    setSearchQuery("");

    setOpenMenuId(null);
  }


  function handleSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Escape") {
      setSearchOpen(false);
      setSearchQuery("");
    }
  }


  const filteredChats =
    chatHistory.filter(
      (chat) => {
        const query =
          searchQuery
            .trim()
            .toLowerCase();

        if (!query) {
          return true;
        }

        return (
          chat.title
            .toLowerCase()
            .includes(query) ||
          chat.messages.some(
            (message) =>
              message.text
                .toLowerCase()
                .includes(query)
          )
        );
      }
    );


  const pinnedChats =
    filteredChats.filter(
      (chat) => chat.pinned
    );

  const recentChats =
    filteredChats.filter(
      (chat) => !chat.pinned
    );


  /* =======================================================
     CAREER PROFILE
     ======================================================= */

  /* =======================================================
     FILE SELECT
     ======================================================= */

  async function handleFileSelect(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      if (
        !file.type.startsWith("image/")
      ) {
        setSelectedFile(file);
        setImagePreview(null);

        return;
      }

      const processed =
        await resizeImage(file);

      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }

      setSelectedFile(
        processed.file
      );

      setImagePreview(
        processed.dataUrl
      );
    } catch (error) {
      console.error(
        "Image processing failed:",
        error
      );

      setSelectedFile(file);

      setImagePreview(null);
    } finally {
      event.target.value = "";
    }
  }


  /* =======================================================
     REMOVE FILE
     ======================================================= */

  function removeSelectedFile() {
    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    setSelectedFile(null);

    setImagePreview(null);

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  }


  /* =======================================================
     COPY CODE
     ======================================================= */

  async function handleCopy(
    code: string
  ) {
    try {
      await navigator.clipboard.writeText(
        code
      );

      setCopiedCode(code);

      setTimeout(() => {
        setCopiedCode("");
      }, 1800);
    } catch (error) {
      console.error(
        "Copy failed:",
        error
      );
    }
  }


  /* =======================================================
     USER MESSAGE ACTIONS
     ======================================================= */

  function showMessageActionStatus(message: string) {
    setMessageActionStatus(message);

    window.setTimeout(() => {
      setMessageActionStatus(null);
    }, 1600);
  }

  async function handleCopyUserMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.text || "");
      showMessageActionStatus("Copied");
    } catch (error) {
      console.error("Could not copy user message:", error);
    }
  }

  function handleEditUserMessage(message: Message) {
    setInput(message.text || "");
    setActiveUserMessageId(null);
    composerInputRef.current?.focus();
  }

  async function handleShareUserMessage(message: Message) {
    const text = message.text || "";

    try {
      if (navigator.share) {
        await navigator.share({
          text,
        });
      } else {
        await navigator.clipboard.writeText(text);
        showMessageActionStatus("Copied to share");
      }
    } catch (error) {
      // AbortError simply means the user closed the native share sheet.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("Could not share user message:", error);
      }
    }
  }


  /* =======================================================
     MARKDOWN
     ======================================================= */

  const markdownComponents:
    Components = {

    code({
      className,
      children,
      ...props
    }) {
      const code =
        String(children).replace(
          /\n$/,
          ""
        );

      if (!className) {
        return (
          <code
            className="inline-code"
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <div className="code-block-wrapper">

          <div className="code-block-header">

            <span>
              Code
            </span>

            <button
              type="button"
              onClick={() =>
                handleCopy(code)
              }
              className="copy-code-btn"
            >
              {copiedCode === code
                ? "Copied"
                : "Copy"}
            </button>

          </div>

          <pre>
            <code
              className={className}
              {...props}
            >
              {children}
            </code>
          </pre>

        </div>
      );
    },

    table({ children }) {
      return (
        <div className="table-wrapper">
          <table>
            {children}
          </table>
        </div>
      );
    },
  };


  /* =======================================================
     SEND
     ======================================================= */

  async function handleSend(
    prompt?: string
  ) {

    const text =
      (prompt ?? input).trim();

    if (
      !text &&
      !selectedFile
    ) {
      return;
    }

    if (loading) {
      return;
    }

    let chatId =
      activeChatIdRef.current;

    if (!chatId) {
      chatId =
        createChatId();

      setActiveChatId(chatId);

      activeChatIdRef.current =
        chatId;
    }

    const previousMessages =
      [...messages];

    // IMPORTANT: keep the complete conversation in the UI/localStorage,
    // but send only a bounded context window to the backend.
    const backendHistory =
      buildBackendHistory(previousMessages);

    /* =====================================================
       PROCESS ATTACHMENT
       ===================================================== */

    let attachment:
      | MessageAttachment
      | undefined;

    if (selectedFile) {
      let dataUrl:
        | string
        | undefined;

      if (
        selectedFile.type.startsWith(
          "image/"
        )
      ) {
        try {
          dataUrl =
            await fileToDataUrl(
              selectedFile
            );
        } catch (error) {
          console.error(
            "Could not create image data:",
            error
          );
        }
      }

      attachment = {
        name:
          selectedFile.name,

        type:
          selectedFile.type,

        dataUrl,
      };
    }


    /* =====================================================
       USER MESSAGE
       ===================================================== */

    const userMessage:
      Message = {
      id:
        createMessageId(),

      text,

      sender: "user",

      attachment,
    };

    const messagesWithUser =
      [
        ...previousMessages,
        userMessage,
      ];

    setMessages(
      messagesWithUser
    );

    updateChat(
      chatId,
      messagesWithUser
    );

    setInput("");

    setLoading(true);


    /* =====================================================
       BACKEND
       ===================================================== */

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      // HealthAI backend (LifeRequest): { message, history }
      // Does NOT accept multipart/form-data or a profile field.
      const response: Response =
        await fetch(
          BACKEND_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            signal:
              controller.signal,

            body:
              JSON.stringify({
                message:
                  text,

                history:
                  backendHistory,
              }),
          }
        );

      window.clearTimeout(timeoutId);

      const responseText =
        await response.text();

      console.log(
        "Backend status:",
        response.status
      );

      console.log(
        "Backend response:",
        responseText
      );

      if (!response.ok) {
        let backendMessage =
          responseText;

        try {
          const errorJson =
            JSON.parse(
              responseText
            );

          if (Array.isArray(errorJson.detail)) {
            // FastAPI 422 Unprocessable Entity â€” detail is an array of validation errors
            backendMessage = errorJson.detail
              .map((e: { loc?: string[]; msg?: string }) =>
                [e.loc?.join("."), e.msg].filter(Boolean).join(": ")
              )
              .join(" | ");
          } else {
            backendMessage =
              (typeof errorJson.detail === "string" ? errorJson.detail : null) ||
              errorJson.message ||
              errorJson.error ||
              responseText;
          }
        } catch {
          // Not JSON.
        }

        throw new Error(
          `Backend returned ${response.status}: ${backendMessage}`
        );
      }

      let data: any;

      try {
        data =
          JSON.parse(
            responseText
          );
      } catch {
        throw new Error(
          "Backend returned an invalid JSON response."
        );
      }

      let aiReply =
        data.reply ??
        data.response ??
        data.message ??
        data.answer ??
        "";

      if (data.truncated) {
        aiReply +=
          "\n\n---\n*The response reached the model output limit. Ask me to continue from where it stopped.*";
      }

      const aiMessage:
        Message = {
        id:
          createMessageId(),

        text:
          String(
            aiReply ||
            "I couldn't generate a response."
          ),

        sender: "ai",
      };

      const finalMessages =
        [
          ...messagesWithUser,
          aiMessage,
        ];

      setMessages(
        finalMessages
      );

      updateChat(
        chatId,
        finalMessages
      );

    } catch (error) {
      window.clearTimeout(timeoutId);

      if (error instanceof DOMException && error.name === "AbortError") {
        error = new Error(
          "HealthAI took too long to respond. Please try again with a shorter question."
        );
      }

      console.error(
        "HealthAI error:",
        error
      );

      const errorText =
        error instanceof Error
          ? error.message
          : "Unknown error";

      const errorMessage:
        Message = {
        id:
          createMessageId(),

        text:
          `Sorry, I couldn't process your request.\n\n**Error:** ${errorText}`,

        sender: "ai",
      };

      const finalMessages =
        [
          ...messagesWithUser,
          errorMessage,
        ];

      setMessages(
        finalMessages
      );

      updateChat(
        chatId,
        finalMessages
      );

    } finally {
      setLoading(false);

      removeSelectedFile();
    }
  }


  /* =======================================================
     ENTER
     ======================================================= */

  function handleInputKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      handleSend();
    }
  }


  /* =======================================================
     CHAT LIST
     ======================================================= */

  function renderChat(
    chat: ChatSession
  ) {
    const menuOpen =
      openMenuId === chat.id;

    return (
      <div
        className={
          `history-row ${activeChatId === chat.id
            ? "active"
            : ""
          }`
        }
        key={chat.id}
      >

        <button
          type="button"
          className="history-chat"
          onClick={() =>
            handleOpenChat(chat)
          }
          disabled={loading}
          title={chat.title}
        >
          <span className="history-chat-title">
            {chat.title}
          </span>
        </button>


        <div
          className={
            `history-actions ${menuOpen
              ? "menu-open"
              : ""
            }`
          }
        >

          <button
            type="button"
            className="history-action-button pin-button"
            onClick={(event) =>
              handlePinChat(
                event,
                chat.id
              )
            }
            title={
              chat.pinned
                ? "Unpin chat"
                : "Pin chat"
            }
            aria-label={
              chat.pinned
                ? "Unpin chat"
                : "Pin chat"
            }
          >
            <PinIcon />
          </button>


          <button
            type="button"
            className="history-action-button more-button"
            onClick={(event) => {
              event.stopPropagation();

              setOpenMenuId(
                (current) =>
                  current === chat.id
                    ? null
                    : chat.id
              );
            }}
            title="More"
            aria-label="More"
          >
            <MoreIcon />
          </button>


          {menuOpen && (
            <div
              className="chat-menu"
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                }}
              >
                <ShareIcon />
                <span>Share</span>
              </button>


              <button
                type="button"
                onClick={(event) =>
                  handleRenameChat(
                    event,
                    chat
                  )
                }
              >
                <RenameIcon />
                <span>Rename</span>
              </button>


              <div className="chat-menu-divider" />


              <button
                type="button"
                onClick={(event) =>
                  handlePinChat(
                    event,
                    chat.id
                  )
                }
              >
                <PinIcon />

                <span>
                  {chat.pinned
                    ? "Unpin chat"
                    : "Pin chat"}
                </span>
              </button>


              <button
                type="button"
                onClick={() =>
                  setOpenMenuId(null)
                }
              >
                <ArchiveIcon />
                <span>Archive</span>
              </button>


              <button
                type="button"
                className="delete-menu-item"
                onClick={(event) =>
                  handleDeleteChat(
                    event,
                    chat.id
                  )
                }
              >
                <TrashIcon />
                <span>Delete</span>
              </button>


              <div className="chat-menu-divider" />


              <button
                type="button"
                className="move-project-item"
                onClick={() =>
                  setOpenMenuId(null)
                }
              >
                <span className="folder-menu-icon">
                  â–±
                </span>

                <span>
                  Move to project
                </span>

                <span className="menu-arrow">
                  â€º
                </span>
              </button>

            </div>
          )}

        </div>

      </div>
    );
  }


  /* =======================================================
     UI
     ======================================================= */

  return (
    <>
    <div
      className={
        `agent-chat-page ${sidebarCollapsed
          ? "sidebar-collapsed"
          : ""
        }`
      }
    >

      {/* =================================================
          SIDEBAR
          ================================================= */}

      {!sidebarCollapsed ? (

        <aside className="agent-chat-sidebar">

          {/* HEADER */}

          <div className="sidebar-header">

            <div className="sidebar-brand">
              AgentVerse AI
            </div>


            <div className="sidebar-header-actions">

              <button
                type="button"
                className={
                  `sidebar-header-icon ${searchOpen
                    ? "active"
                    : ""
                  }`
                }
                onClick={
                  toggleSearch
                }
                title="Search chats"
                aria-label="Search chats"
              >
                <SearchIcon />
              </button>


              <button
                type="button"
                className="sidebar-header-icon"
                onClick={() => {
                  setSidebarCollapsed(
                    true
                  );

                  setSearchOpen(false);

                  setSearchQuery("");

                  setOpenMenuId(null);
                }}
                title="Close sidebar"
                aria-label="Close sidebar"
              >
                <CollapseIcon />
              </button>

            </div>

          </div>


          {/* SEARCH */}

          {searchOpen && (
            <div className="sidebar-search">

              <SearchIcon />

              <input
                ref={
                  searchInputRef
                }
                type="text"
                value={
                  searchQuery
                }
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                onKeyDown={
                  handleSearchKeyDown
                }
                placeholder="Search chats"
                autoComplete="off"
              />

              {searchQuery && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() =>
                    setSearchQuery("")
                  }
                >
                  Ã—
                </button>
              )}

            </div>
          )}


          {/* NEW CHAT */}

          <button
            className="new-chat-button"
            type="button"
            onClick={
              handleNewChat
            }
            disabled={loading}
          >
            <span>+</span>
            New chat
          </button>


          {/* HISTORY */}

          <div className="history-label">
            Chat history
          </div>


          <div className="history-list">

            {/* PINNED */}

            {pinnedChats.length > 0 && (
              <div className="history-section">

                <div className="history-section-title">
                  Pinned
                </div>

                <div className="history-section-list">
                  {pinnedChats.map(
                    renderChat
                  )}
                </div>

              </div>
            )}


            {/* RECENTS */}

            {recentChats.length > 0 && (
              <div className="history-section">

                <div className="history-section-title">
                  Recents
                </div>

                <div className="history-section-list">
                  {recentChats.map(
                    renderChat
                  )}
                </div>

              </div>
            )}


            {filteredChats.length ===
              0 && (
                <div className="empty-history">
                  {searchQuery
                    ? "No chats found."
                    : "No conversations yet."}
                </div>
              )}

          </div>


          {/* BOTTOM */}

          <div className="sidebar-bottom">

            <button
              type="button"
              className="clear-chat-button"
              onClick={
                handleClearChat
              }
              disabled={
                loading ||
                messages.length ===
                0
              }
            >
              Clear current chat
            </button>

          </div>

        </aside>

      ) : (

        /* =================================================
           COLLAPSED SIDEBAR
           ================================================= */

        <aside className="collapsed-sidebar">

          <div className="collapsed-sidebar-top">

            <button
              type="button"
              className="collapsed-sidebar-button"
              onClick={() =>
                setSidebarCollapsed(
                  false
                )
              }
              title="Open sidebar"
              aria-label="Open sidebar"
            >
              <ExpandIcon />
            </button>


            <button
              type="button"
              className="collapsed-sidebar-button"
              onClick={() => {
                setSidebarCollapsed(
                  false
                );

                setTimeout(() => {
                  setSearchOpen(
                    true
                  );
                }, 0);
              }}
              title="Search chats"
              aria-label="Search chats"
            >
              <SearchIcon />
            </button>

          </div>

        </aside>
      )}


      {/* =================================================
          MAIN
          ================================================= */}

      <main className="agent-chat-main">

        {/* TOP BAR */}

        <header className="chat-topbar">

          <div className="chat-title">
            HealthAI
          </div>

          <div className="chat-status">

            <span />

            AI Health Assistant

          </div>

        </header>


        {/* =================================================
            MESSAGES
            ================================================= */}

        <div
          className="messages-container"
          ref={messagesRef}
        >

          {messages.length ===
            0 && (

              <div className="welcome">

                <div className="welcome-logo">
                  AI
                </div>

                <h1>
                  How can I help with
                  your health?
                </h1>

                <p>
                  Learn about wellness, fitness,
                  nutrition, and healthy routines.
                </p>

                <div className="welcome-prompts">

                  <button
                    type="button"
                    onClick={() =>
                      handleSend(
                        "Create a beginner 4-week fitness routine"
                      )
                    }
                  >
                    Create a fitness routine
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSend(
                        "Explain carbohydrates, protein, and fats"
                      )
                    }
                  >
                    Explain nutrition basics
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSend(
                        "Create a healthy daily routine"
                      )
                    }
                  >
                    Build a healthy routine
                  </button>

                </div>

              </div>
            )}


          <div className="conversation">

            {messages.map(
              (message) => (

                <div
                  key={
                    message.id
                  }
                  className={
                    message.sender ===
                      "user"
                      ? "message-row user-row"
                      : "message-row ai-row"
                  }
                >

                  {message.sender === "user" ? (
                    <div
                      className={
                        activeUserMessageId === message.id
                          ? "user-message-group is-active"
                          : "user-message-group"
                      }
                      onClick={() =>
                        setActiveUserMessageId(message.id)
                      }
                    >
                      <div className="user-bubble">
                        {message.text && (
                          <div>{message.text}</div>
                        )}

                        {message.attachment?.dataUrl && (
                          <img
                            src={message.attachment.dataUrl}
                            alt={message.attachment.name}
                            className="chat-image"
                          />
                        )}

                        {message.attachment &&
                          !message.attachment.dataUrl && (
                            <div className="chat-file">
                              <span>{message.attachment.name}</span>
                            </div>
                          )}
                      </div>

                      <div
                        className="user-message-actions"
                        aria-label="Message actions"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleCopyUserMessage(message)}
                          title="Copy"
                          aria-label="Copy message"
                        >
                          <CopyMessageIcon />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEditUserMessage(message)}
                          title="Edit"
                          aria-label="Edit message"
                        >
                          <EditMessageIcon />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleShareUserMessage(message)}
                          title="Share"
                          aria-label="Share message"
                        >
                          <ShareIcon />
                        </button>

                        {messageActionStatus &&
                          activeUserMessageId === message.id && (
                            <span className="message-action-status">
                              {messageActionStatus}
                            </span>
                          )}
                      </div>
                    </div>
                  ) : (
                    <div className="ai-content">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {cleanMarkdown(message.text)}
                      </ReactMarkdown>
                    </div>
                  )}

                </div>

              )
            )}


            {loading && (

              <div className="message-row ai-row">

                <div className="ai-content typing">

                  <span />
                  <span />
                  <span />

                </div>

              </div>

            )}

          </div>

        </div>


        {/* =================================================
            FILE PREVIEW
            ================================================= */}

        {selectedFile && (

          <div className="composer-file-preview">

            {imagePreview && (

              <img
                src={
                  imagePreview
                }
                alt={
                  selectedFile.name
                }
                className="composer-preview-image"
              />

            )}

            <div className="composer-file-info">

              <strong>
                {
                  selectedFile.name
                }
              </strong>

              <span>
                {
                  selectedFile.type.startsWith(
                    "image/"
                  )
                    ? "Image"
                    : "File"
                }
              </span>

            </div>

            <button
              type="button"
              onClick={
                removeSelectedFile
              }
              className="remove-file"
            >
              Ã—
            </button>

          </div>
        )}


        {/* =================================================
            COMPOSER
            ================================================= */}

        <div className="composer-area">

          <div className="composer">

            <input
              ref={
                fileInputRef
              }
              type="file"
              className="hidden-file-input"
              onChange={
                handleFileSelect
              }
              accept="
                .pdf,
                .doc,
                .docx,
                .txt,
                .png,
                .jpg,
                .jpeg,
                .webp
              "
            />


            <button
              type="button"
              className="composer-plus"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={loading}
              title="Attach file"
              aria-label="Attach file"
            >
              +
            </button>


            <input
              ref={composerInputRef}
              type="text"
              className="composer-input"
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value
                )
              }
              onKeyDown={
                handleInputKeyDown
              }
              disabled={loading}
              placeholder="Ask HealthAI anything about health and wellness..."
            />


            <button
              type="button"
              className="composer-send"
              onClick={() =>
                handleSend()
              }
              disabled={
                loading ||
                (
                  !input.trim() &&
                  !selectedFile
                )
              }
              title="Send"
              aria-label="Send"
            >
              â†‘
            </button>

          </div>

          <div className="composer-disclaimer">
            HealthAI can make mistakes.
            Check important information.
          </div>

        </div>

      </main>

    </div>

    <Footer />
    </>
  );
}


export default HealthAI;

