import "../../styles/AgentChat.css";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

import {
  postFormData,
  postJson,
  toUserMessage,
} from "../../services/apiClient";

import {
  ArchiveIcon,
  AttachIcon,
  CloseIcon,
  CollapseIcon,
  CopyMessageIcon,
  EditMessageIcon,
  ExpandIcon,
  MenuIcon,
  MoreIcon,
  PinIcon,
  RenameIcon,
  SearchIcon,
  SendIcon,
  ShareIcon,
  TrashIcon,
} from "./icons";

import {
  MAX_UPLOAD_BYTES,
  buildBackendHistory,
  createChatId,
  createMessageId,
  extractImageFromClipboard,
  extractReply,
  fileToDataUrl,
  formatFileSize,
  getCareerProfile,
  getChatTitle,
  isTruncated,
  loadHistory,
  resizeImage,
  saveHistory,
  sortChats,
} from "./chatUtils";

import type {
  AgentChatConfig,
  ChatSession,
  Message,
  MessageAttachment,
} from "./types";


/*
 * Below this width the sidebar stops taking layout space and
 * becomes an overlay drawer, so the chat always owns the full
 * viewport width.
 */
const MOBILE_QUERY = "(max-width: 900px)";

function prefersMobileLayout(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }

  return window.matchMedia(MOBILE_QUERY).matches;
}

/* The breakpoint is read as an external store so a resize
   re-renders without an effect writing state back. */
function subscribeToBreakpoint(
  onChange: () => void
): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => { };
  }

  const query = window.matchMedia(MOBILE_QUERY);

  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
}

function desktopFallback(): boolean {
  return false;
}

type AgentChatProps = {
  config: AgentChatConfig;
};

function AgentChat({ config }: AgentChatProps) {

  /* =======================================================
     STATE
     ======================================================= */

  /* Stored chats are read once during the first render so the
     sidebar is populated immediately. They are NOT opened: every
     visit to an agent starts on a new, empty chat, and an old
     conversation loads only when the user picks it from the
     sidebar. */
  const [storedHistory] = useState(() =>
    loadHistory(config.storageKey)
  );

  /* The id for that new chat. It is only written into history
     once the first message is actually sent. */
  const [initialChatId] = useState(createChatId);

  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [chatHistory, setChatHistory] =
    useState<ChatSession[]>(storedHistory);

  const [activeChatId, setActiveChatId] = useState<
    string | null
  >(initialChatId);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [imagePreview, setImagePreview] =
    useState<string | null>(null);

  const [attachmentNotice, setAttachmentNotice] =
    useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState("");

  const [activeUserMessageId, setActiveUserMessageId] =
    useState<string | null>(null);

  const [messageActionStatus, setMessageActionStatus] =
    useState<string | null>(null);


  /* Desktop: the sidebar collapses to a narrow rail.
     Mobile: the sidebar slides in over the chat. */
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [mobileSidebarOpen, setMobileSidebarOpen] =
    useState(false);

  const isMobile = useSyncExternalStore(
    subscribeToBreakpoint,
    prefersMobileLayout,
    desktopFallback
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [openMenuId, setOpenMenuId] =
    useState<string | null>(null);


  /* =======================================================
     REFS
     ======================================================= */

  /* The scrolling messages column. */
  const messagesRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);

  const activeChatIdRef = useRef<string | null>(initialChatId);

  /* Guards against a second submit landing before React has
     re-rendered with loading = true. */
  const sendingRef = useRef(false);

  /* Stops the scroll effect from re-running for a message it
     has already positioned. */
  const lastScrolledMessageIdRef =
    useRef<string | null>(null);

  const initialScrollDoneRef = useRef(false);

  const statusTimeoutRef = useRef<number | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);


  /* =======================================================
     DERIVED LAYOUT FLAGS
     ======================================================= */

  const showCollapsedRail = !isMobile && sidebarCollapsed;
  const showSidebar = isMobile || !sidebarCollapsed;
  const sidebarIsOpen = isMobile ? mobileSidebarOpen : true;


  /* =======================================================
     ACTIVE CHAT REF
     ======================================================= */

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);


  /* =======================================================
     LOCK PAGE SCROLLING WHILE THE CHAT IS MOUNTED
     -------------------------------------------------------
     index.css gives body a min-height of 100vh, which on a
     phone is taller than 100dvh while the browser toolbar is
     visible. Without this the page itself could scroll by the
     height of that toolbar. The class is removed on unmount so
     every other route keeps scrolling normally.
     ======================================================= */

  useEffect(() => {
    const { body } = document;

    body.classList.add("agent-chat-active");

    return () => {
      body.classList.remove("agent-chat-active");
    };
  }, []);


  /* =======================================================
     PERSIST HISTORY
     ======================================================= */

  useEffect(() => {
    saveHistory(config.storageKey, chatHistory);
  }, [chatHistory, config.storageKey]);


  /* =======================================================
     CLEAR PENDING TIMERS ON UNMOUNT
     ======================================================= */

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current !== null) {
        window.clearTimeout(statusTimeoutRef.current);
      }

      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);


  /* =======================================================
     SEARCH FOCUS
     ======================================================= */

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [searchOpen]);


  /* =======================================================
     CLOSE THE ROW MENU ON AN OUTSIDE CLICK
     ======================================================= */

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      if (target?.closest(".history-actions")) {
        return;
      }

      setOpenMenuId(null);
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
    };
  }, [openMenuId]);


  /* =======================================================
     KEYBOARD
     -------------------------------------------------------
     Escape closes whatever is open. Typing a printable key
     focuses the composer, the way ChatGPT does.
     ======================================================= */

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
        setMobileSidebarOpen(false);

        return;
      }

      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing ||
        event.key.length !== 1 ||
        loading ||
        mobileSidebarOpen
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;

      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "BUTTON" ||
        target?.isContentEditable
      ) {
        return;
      }

      composerInputRef.current?.focus();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loading, mobileSidebarOpen]);


  /* =======================================================
     CLIPBOARD IMAGE PASTE
     -------------------------------------------------------
     Ctrl+V anywhere in the chat attaches an image from the
     clipboard. A text-only clipboard is left completely alone,
     and the sidebar search box keeps its normal paste.
     ======================================================= */

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (loading) {
        return;
      }

      const target = event.target as HTMLElement | null;

      const isOtherTextField =
        target !== null &&
        target !== composerInputRef.current &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isOtherTextField) {
        return;
      }

      const file = extractImageFromClipboard(
        event.clipboardData
      );

      /* No image in the clipboard: let the paste happen. */
      if (!file) {
        return;
      }

      event.preventDefault();

      void acceptImageFile(file);
    }

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [loading]);


  /* =======================================================
     SCROLL POSITION
     -------------------------------------------------------
     Only the messages column ever scrolls, so none of this
     can move the page itself. Each message is positioned at
     most once, which keeps the effect out of a scroll loop.
     ======================================================= */

  useEffect(() => {
    const element = messagesRef.current;

    if (!element) {
      return;
    }

    if (messages.length === 0) {
      lastScrolledMessageIdRef.current = null;
      initialScrollDoneRef.current = true;

      return;
    }

    const lastMessage = messages[messages.length - 1];

    /* Opening a stored conversation lands on its newest turn. */
    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      lastScrolledMessageIdRef.current = lastMessage.id;
      element.scrollTop = element.scrollHeight;

      return;
    }

    if (lastScrolledMessageIdRef.current === lastMessage.id) {
      return;
    }

    lastScrolledMessageIdRef.current = lastMessage.id;

    const frame = requestAnimationFrame(() => {
      if (lastMessage.sender === "user") {
        element.scrollTop = element.scrollHeight;

        return;
      }

      /* An answer can be far taller than the viewport, so put
         its first line near the top instead of jumping to the
         very end of it. */
      const rows = element.querySelectorAll<HTMLElement>(
        ".conversation > .message-row"
      );

      const lastRow = rows[rows.length - 1];

      if (!lastRow) {
        element.scrollTop = element.scrollHeight;

        return;
      }

      element.scrollTop = Math.max(lastRow.offsetTop - 28, 0);
    });

    return () => cancelAnimationFrame(frame);
  }, [messages]);


  /* Keep the typing indicator in view once a request starts. */
  useEffect(() => {
    if (!loading) {
      return;
    }

    const element = messagesRef.current;

    if (!element) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });

    return () => cancelAnimationFrame(frame);
  }, [loading]);


  /* =======================================================
     SIDEBAR
     ======================================================= */

  function openSidebar() {
    if (isMobile) {
      setMobileSidebarOpen(true);

      return;
    }

    setSidebarCollapsed(false);
  }

  function closeSidebar() {
    setSearchOpen(false);
    setSearchQuery("");
    setOpenMenuId(null);

    if (isMobile) {
      setMobileSidebarOpen(false);

      return;
    }

    setSidebarCollapsed(true);
  }

  /* Selecting anything in the drawer should reveal the chat. */
  function dismissMobileSidebar() {
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  }


  /* =======================================================
     UPDATE CHAT
     ======================================================= */

  function updateChat(
    chatId: string,
    nextMessages: Message[]
  ) {
    setChatHistory((previous) => {
      const exists = previous.some(
        (chat) => chat.id === chatId
      );

      if (exists) {
        return sortChats(
          previous.map((chat) =>
            chat.id === chatId
              ? {
                ...chat,
                title: getChatTitle(nextMessages),
                messages: nextMessages,
                updatedAt: Date.now(),
              }
              : chat
          )
        );
      }

      const newChat: ChatSession = {
        id: chatId,
        title: getChatTitle(nextMessages),
        messages: nextMessages,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pinned: false,
      };

      return sortChats([newChat, ...previous]);
    });
  }


  /* =======================================================
     NEW CHAT
     ======================================================= */

  function startBlankChat() {
    const id = createChatId();

    setActiveChatId(id);
    activeChatIdRef.current = id;

    setMessages([]);
    setInput("");
    setOpenMenuId(null);
    setActiveUserMessageId(null);

    lastScrolledMessageIdRef.current = null;
    initialScrollDoneRef.current = true;

    removeSelectedFile();
  }

  function handleNewChat() {
    if (loading) {
      return;
    }

    startBlankChat();
    setSearchQuery("");
    dismissMobileSidebar();
  }


  /* =======================================================
     OPEN CHAT
     ======================================================= */

  function handleOpenChat(chat: ChatSession) {
    if (loading) {
      return;
    }

    setActiveChatId(chat.id);
    activeChatIdRef.current = chat.id;

    setMessages(chat.messages || []);
    setInput("");
    setOpenMenuId(null);
    setActiveUserMessageId(null);

    /* Re-arm the one-off jump so the newest turn is visible. */
    lastScrolledMessageIdRef.current = null;
    initialScrollDoneRef.current = false;

    removeSelectedFile();
    dismissMobileSidebar();
  }


  /* =======================================================
     PIN / DELETE / RENAME
     ======================================================= */

  function handlePinChat(
    event: React.MouseEvent,
    chatId: string
  ) {
    event.stopPropagation();

    if (loading) {
      return;
    }

    setChatHistory((previous) =>
      sortChats(
        previous.map((chat) =>
          chat.id === chatId
            ? {
              ...chat,
              pinned: !chat.pinned,
              updatedAt: Date.now(),
            }
            : chat
        )
      )
    );

    setOpenMenuId(null);
  }

  function handleDeleteChat(
    event: React.MouseEvent,
    chatId: string
  ) {
    event.stopPropagation();

    if (loading) {
      return;
    }

    setChatHistory((previous) =>
      previous.filter((chat) => chat.id !== chatId)
    );

    if (activeChatIdRef.current === chatId) {
      startBlankChat();
    }

    setOpenMenuId(null);
  }


  function handleRenameChat(
    event: React.MouseEvent,
    chat: ChatSession
  ) {
    event.stopPropagation();

    if (loading) {
      return;
    }

    const newTitle = window.prompt("Rename chat", chat.title);

    if (newTitle === null || !newTitle.trim()) {
      setOpenMenuId(null);

      return;
    }

    setChatHistory((previous) =>
      previous.map((item) =>
        item.id === chat.id
          ? {
            ...item,
            title: newTitle.trim(),
            updatedAt: Date.now(),
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

    const current = activeChatIdRef.current;

    if (current) {
      setChatHistory((previous) =>
        previous.filter((chat) => chat.id !== current)
      );
    }

    startBlankChat();
    dismissMobileSidebar();
  }


  /* =======================================================
     SEARCH
     ======================================================= */

  function toggleSearch() {
    setSearchOpen((previous) => !previous);
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

  const query = searchQuery.trim().toLowerCase();

  const filteredChats = query
    ? chatHistory.filter(
      (chat) =>
        chat.title.toLowerCase().includes(query) ||
        chat.messages.some((message) =>
          message.text.toLowerCase().includes(query)
        )
    )
    : chatHistory;

  const pinnedChats = filteredChats.filter(
    (chat) => chat.pinned
  );

  const recentChats = filteredChats.filter(
    (chat) => !chat.pinned
  );


  /* =======================================================
     ATTACHMENTS
     ======================================================= */

  function removeSelectedFile() {
    setSelectedFile(null);
    setImagePreview(null);
    setAttachmentNotice(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  /* Every agent endpoint accepts an image, but only images —
     the backend has no document pipeline, so anything else is
     rejected here instead of failing on the server. */
  const IMAGE_ACCEPT =
    "image/png,image/jpeg,image/jpg,image/webp,image/gif";

  /*
   * The single entry point for a pending attachment, used by both
   * the file picker and a clipboard paste, so the two can never
   * behave differently.
   */
  async function acceptImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setSelectedFile(null);
      setImagePreview(null);

      setAttachmentNotice(
        "Only images can be analyzed right now. Please attach a PNG, JPG, or WEBP file."
      );

      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setSelectedFile(null);
      setImagePreview(null);

      setAttachmentNotice(
        `That image is ${formatFileSize(file.size)}. Please choose one under 10 MB.`
      );

      return;
    }

    setAttachmentNotice(null);

    try {
      const processed = await resizeImage(file);

      setSelectedFile(processed.file);
      setImagePreview(processed.dataUrl);
    } catch (error) {
      console.error("Image processing failed:", error);

      /* Keep the original file so the upload still happens. */
      setSelectedFile(file);
      setImagePreview(null);
    }

    /* Focus belongs in the text box now, not on the attach
       button — otherwise the next Enter re-activates that button
       and reopens the file picker. */
    composerInputRef.current?.focus();
  }

  function handleFileSelect(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    /* Reset immediately so picking the same file twice works. */
    event.target.value = "";

    if (file) {
      void acceptImageFile(file);
    }
  }

  function openFilePicker() {
    /* Move focus off the attach button before the modal dialog
       opens, so the browser restores focus to the text box when
       the dialog closes — whether a file was chosen or not. */
    composerInputRef.current?.focus();

    fileInputRef.current?.click();
  }


  /* =======================================================
     MESSAGE ACTIONS
     ======================================================= */

  function showMessageActionStatus(status: string) {
    setMessageActionStatus(status);

    if (statusTimeoutRef.current !== null) {
      window.clearTimeout(statusTimeoutRef.current);
    }

    statusTimeoutRef.current = window.setTimeout(() => {
      setMessageActionStatus(null);
    }, 1600);
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);

      setCopiedCode(code);

      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }

      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedCode("");
      }, 1800);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  async function handleCopyUserMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.text || "");

      showMessageActionStatus("Copied");
    } catch (error) {
      console.error("Could not copy that message:", error);
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
        await navigator.share({ text });

        return;
      }

      await navigator.clipboard.writeText(text);

      showMessageActionStatus("Copied to share");
    } catch (error) {
      /* AbortError only means the native share sheet was closed. */
      if (
        !(
          error instanceof DOMException &&
          error.name === "AbortError"
        )
      ) {
        console.error("Could not share that message:", error);
      }
    }
  }


  /* =======================================================
     MARKDOWN
     ======================================================= */

  const markdownComponents: Components = {
    code({ className, children, ...props }) {
      const code = String(children).replace(/\n$/, "");

      if (!className) {
        return (
          <code className="inline-code" {...props}>
            {children}
          </code>
        );
      }

      return (
        <div className="code-block-wrapper">

          <div className="code-block-header">

            <span>Code</span>

            <button
              type="button"
              onClick={() => handleCopy(code)}
              className="copy-code-btn"
            >
              {copiedCode === code ? "Copied" : "Copy"}
            </button>

          </div>

          <pre>
            <code className={className} {...props}>
              {children}
            </code>
          </pre>

        </div>
      );
    },

    table({ children }) {
      return (
        <div className="table-wrapper">
          <table>{children}</table>
        </div>
      );
    },
  };


  /* =======================================================
     SEND
     ======================================================= */

  async function handleSend(prompt?: string) {
    const text = (prompt ?? input).trim();

    /* Every agent endpoint reads multipart, so the file is sent
       whenever one is attached. */
    const fileToSend = selectedFile;

    if (!text && !fileToSend) {
      return;
    }

    /* Synchronous latch: a second Enter or click in the same
       tick cannot start a duplicate request. */
    if (sendingRef.current || loading) {
      return;
    }

    sendingRef.current = true;

    let chatId = activeChatIdRef.current;

    if (!chatId) {
      chatId = createChatId();

      setActiveChatId(chatId);
      activeChatIdRef.current = chatId;
    }

    const previousMessages = [...messages];

    /* The transcript keeps everything; the model receives only
       a bounded, error-free window of it. */
    const backendHistory = buildBackendHistory(
      previousMessages
    );

    /*
     * Build the attachment that will belong to the SENT MESSAGE.
     * It is a self-contained base64 data URL, so it is completely
     * independent of the composer's pending state and of any
     * object URL lifetime — clearing the composer below cannot
     * blank out the image already in the transcript.
     */
    let attachment: MessageAttachment | undefined;

    if (fileToSend) {
      let dataUrl = imagePreview ?? undefined;

      if (!dataUrl && fileToSend.type.startsWith("image/")) {
        try {
          dataUrl = await fileToDataUrl(fileToSend);
        } catch (error) {
          console.error(
            "Could not build the image preview:",
            error
          );
        }
      }

      attachment = {
        name: fileToSend.name,
        type: fileToSend.type,
        dataUrl,
      };
    }

    const userMessage: Message = {
      id: createMessageId(),
      text,
      sender: "user",
      attachment,
    };

    const messagesWithUser = [
      ...previousMessages,
      userMessage,
    ];

    /* The image is now part of the conversation. */
    setMessages(messagesWithUser);
    updateChat(chatId, messagesWithUser);

    /*
     * Clear the composer straight away — text AND attachment —
     * so nothing is left hanging above the input while the model
     * is still generating. fileToSend already holds the File for
     * the upload below.
     */
    setInput("");
    setActiveUserMessageId(null);
    removeSelectedFile();

    setLoading(true);

    try {
      const profile = config.usesCareerProfile
        ? getCareerProfile()
        : null;

      let data: unknown;

      if (fileToSend) {
        const formData = new FormData();

        formData.append("message", text);

        formData.append(
          "history",
          JSON.stringify(backendHistory)
        );

        /* The backend reads the same field names from JSON and
           from multipart, so a quiz session survives an upload. */
        if (config.sendsSessionId) {
          formData.append("session_id", chatId);
        }

        if (profile) {
          formData.append(
            "profile",
            JSON.stringify(profile)
          );
        }

        /* Sent once, under the field name the backend reads first.
           It used to be appended as both "image" and "file", which
           uploaded the same bytes twice. */
        formData.append("image", fileToSend, fileToSend.name);

        data = await postFormData(config.endpoint, formData);
      } else {
        const payload: Record<string, unknown> = {
          message: text,
          history: backendHistory,
        };

        /* /study-ai requires session_id; the others reject
           nothing but do not need it. */
        if (config.sendsSessionId) {
          payload.session_id = chatId;
        }

        if (config.usesCareerProfile) {
          payload.profile = profile;
        }

        data = await postJson(config.endpoint, payload);
      }


      let reply = extractReply(data);

      if (!reply) {
        reply =
          "I couldn't generate a response for that. Please try asking again.";
      }

      if (isTruncated(data)) {
        reply +=
          "\n\n---\n*The response reached the model output limit. Ask me to continue from where it stopped.*";
      }

      const aiMessage: Message = {
        id: createMessageId(),
        text: reply,
        sender: "ai",
      };

      const finalMessages = [...messagesWithUser, aiMessage];

      setMessages(finalMessages);
      updateChat(chatId, finalMessages);
    } catch (error) {
      console.error(`${config.name} request failed:`, error);

      const errorMessage: Message = {
        id: createMessageId(),
        text: toUserMessage(error),
        sender: "ai",
        isError: true,
      };

      const finalMessages = [
        ...messagesWithUser,
        errorMessage,
      ];

      setMessages(finalMessages);
      updateChat(chatId, finalMessages);
    } finally {
      /* Always release the latch and the button, on both the
         success and the failure path. The composer was already
         cleared before the request started, and a failure must
         never push the image back into it. */
      sendingRef.current = false;
      setLoading(false);
    }
  }

  /* Enter in the text box submits the form; the attach button is
     type="button" so it is never the submit target. */
  function handleComposerSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    handleSend();
  }

  const canSend =
    !loading &&
    (Boolean(input.trim()) || Boolean(selectedFile));


  /* =======================================================
     HISTORY ROW
     ======================================================= */

  function renderChat(chat: ChatSession) {
    const menuOpen = openMenuId === chat.id;

    return (
      <div
        className={`history-row ${activeChatId === chat.id ? "active" : ""
          }`}
        key={chat.id}
      >

        <button
          type="button"
          className="history-chat"
          onClick={() => handleOpenChat(chat)}
          disabled={loading}
          title={chat.title}
        >
          <span className="history-chat-title">
            {chat.title}
          </span>
        </button>

        <div
          className={`history-actions ${menuOpen ? "menu-open" : ""
            }`}
        >

          <button
            type="button"
            className="history-action-button pin-button"
            onClick={(event) =>
              handlePinChat(event, chat.id)
            }
            title={chat.pinned ? "Unpin chat" : "Pin chat"}
            aria-label={
              chat.pinned ? "Unpin chat" : "Pin chat"
            }
          >
            <PinIcon />
          </button>

          <button
            type="button"
            className="history-action-button more-button"
            onClick={(event) => {
              event.stopPropagation();

              setOpenMenuId((current) =>
                current === chat.id ? null : chat.id
              );
            }}
            title="More"
            aria-label="More options"
          >
            <MoreIcon />
          </button>


          {menuOpen && (
            <div
              className="chat-menu"
              onClick={(event) => event.stopPropagation()}
            >

              <button
                type="button"
                onClick={() => setOpenMenuId(null)}
              >
                <ShareIcon />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={(event) =>
                  handleRenameChat(event, chat)
                }
              >
                <RenameIcon />
                <span>Rename</span>
              </button>

              <div className="chat-menu-divider" />

              <button
                type="button"
                onClick={(event) =>
                  handlePinChat(event, chat.id)
                }
              >
                <PinIcon />

                <span>
                  {chat.pinned ? "Unpin chat" : "Pin chat"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setOpenMenuId(null)}
              >
                <ArchiveIcon />
                <span>Archive</span>
              </button>

              <button
                type="button"
                className="delete-menu-item"
                onClick={(event) =>
                  handleDeleteChat(event, chat.id)
                }
              >
                <TrashIcon />
                <span>Delete</span>
              </button>

              <div className="chat-menu-divider" />

              <button
                type="button"
                className="move-project-item"
                onClick={() => setOpenMenuId(null)}
              >
                <span className="folder-menu-icon">▱</span>

                <span>Move to project</span>

                <span className="menu-arrow">›</span>
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

  const pageClassName = [
    "agent-chat-page",
    showCollapsedRail ? "sidebar-collapsed" : "",
    isMobile && mobileSidebarOpen ? "sidebar-open" : "",
    loading ? "is-loading" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={pageClassName}>

      {/* =================================================
          COLLAPSED RAIL (DESKTOP ONLY)
          ================================================= */}

      {showCollapsedRail && (
        <aside className="collapsed-sidebar">

          <div className="collapsed-sidebar-top">

            <button
              type="button"
              className="collapsed-sidebar-button"
              onClick={openSidebar}
              title="Open sidebar"
              aria-label="Open sidebar"
            >
              <ExpandIcon />
            </button>

            <button
              type="button"
              className="collapsed-sidebar-button"
              onClick={() => {
                setSidebarCollapsed(false);
                setSearchOpen(true);
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
          SIDEBAR
          ================================================= */}

      {showSidebar && (
        <aside
          className={`agent-chat-sidebar ${sidebarIsOpen ? "is-open" : ""
            }`}
          aria-label="Chat history"
        >

          <div className="sidebar-header">

            <div className="sidebar-brand">
              AgentVerse AI
            </div>

            <div className="sidebar-header-actions">

              <button
                type="button"
                className={`sidebar-header-icon ${searchOpen ? "active" : ""
                  }`}
                onClick={toggleSearch}
                title="Search chats"
                aria-label="Search chats"
              >
                <SearchIcon />
              </button>

              <button
                type="button"
                className="sidebar-header-icon"
                onClick={closeSidebar}
                title="Close sidebar"
                aria-label="Close sidebar"
              >
                {isMobile ? <CloseIcon /> : <CollapseIcon />}
              </button>

            </div>

          </div>


          {searchOpen && (
            <div className="sidebar-search">

              <SearchIcon />

              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                onKeyDown={handleSearchKeyDown}
                placeholder="Search chats"
                autoComplete="off"
                aria-label="Search chats"
              />

              {searchQuery && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}

            </div>
          )}

          <button
            className="new-chat-button"
            type="button"
            onClick={handleNewChat}
            disabled={loading}
          >
            <span>+</span>
            New chat
          </button>

          <div className="history-label">
            Chat history
          </div>


          <div className="history-list">

            {pinnedChats.length > 0 && (
              <div className="history-section">

                <div className="history-section-title">
                  Pinned
                </div>

                <div className="history-section-list">
                  {pinnedChats.map(renderChat)}
                </div>

              </div>
            )}

            {recentChats.length > 0 && (
              <div className="history-section">

                <div className="history-section-title">
                  Recents
                </div>

                <div className="history-section-list">
                  {recentChats.map(renderChat)}
                </div>

              </div>
            )}

            {filteredChats.length === 0 && (
              <div className="empty-history">
                {searchQuery
                  ? "No chats found."
                  : "No conversations yet."}
              </div>
            )}

          </div>

          <div className="sidebar-bottom">

            <button
              type="button"
              className="clear-chat-button"
              onClick={handleClearChat}
              disabled={loading || messages.length === 0}
            >
              Clear current chat
            </button>

          </div>

        </aside>
      )}


      {/* =================================================
          DRAWER BACKDROP — TAPPING OUTSIDE CLOSES
          ================================================= */}

      {isMobile && mobileSidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={closeSidebar}
          aria-label="Close sidebar"
        />
      )}


      {/* =================================================
          MAIN
          ================================================= */}

      <main className="agent-chat-main">

        <header className="chat-topbar">

          <div className="chat-topbar-left">
            {isMobile && (
              <button
                type="button"
                className="chat-topbar-button"
                onClick={openSidebar}
                title="Open sidebar"
                aria-label="Open sidebar"
                aria-expanded={mobileSidebarOpen}
              >
                <MenuIcon />
              </button>
            )}
          </div>

          <div className="chat-title">
            {config.name}
          </div>

          <div className="chat-status">
            <span />
            {config.subtitle}
          </div>

        </header>


        {/* =============================================
            MESSAGES — THE ONLY SCROLLING REGION
            ============================================= */}

        <div className="messages-container" ref={messagesRef}>

          {messages.length === 0 && (
            <div className="welcome">

              <div className="welcome-logo">AI</div>

              <h1>{config.welcomeHeading}</h1>

              <p>{config.welcomeText}</p>

              <div className="welcome-prompts">
                {config.suggestions.map((suggestion) => (
                  <button
                    key={suggestion.prompt}
                    type="button"
                    onClick={() =>
                      handleSend(suggestion.prompt)
                    }
                    disabled={loading}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>

            </div>
          )}

          <div className="conversation">

            {messages.map((message) =>
              message.sender === "user" ? (
                <div
                  key={message.id}
                  className="message-row user-row"
                >
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


                    {/* The attachment sits outside the orange
                        bubble so a wide image can never stretch
                        it. */}
                    {message.attachment?.dataUrl && (
                      <div className="user-attachment">
                        <img
                          src={message.attachment.dataUrl}
                          alt={message.attachment.name}
                          className="chat-image"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {message.attachment &&
                      !message.attachment.dataUrl && (
                        <div className="chat-file">
                          <span>
                            {message.attachment.name}
                          </span>
                        </div>
                      )}

                    {message.text && (
                      <div className="user-bubble">
                        <div className="user-bubble-text">
                          {message.text}
                        </div>
                      </div>
                    )}

                    <div
                      className="user-message-actions"
                      aria-label="Message actions"
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                    >

                      <button
                        type="button"
                        onClick={() =>
                          handleCopyUserMessage(message)
                        }
                        title="Copy"
                        aria-label="Copy message"
                      >
                        <CopyMessageIcon />
                      </button>


                      <button
                        type="button"
                        onClick={() =>
                          handleEditUserMessage(message)
                        }
                        title="Edit"
                        aria-label="Edit message"
                      >
                        <EditMessageIcon />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleShareUserMessage(message)
                        }
                        title="Share"
                        aria-label="Share message"
                      >
                        <ShareIcon />
                      </button>

                      {messageActionStatus &&
                        activeUserMessageId ===
                        message.id && (
                          <span className="message-action-status">
                            {messageActionStatus}
                          </span>
                        )}

                    </div>

                  </div>
                </div>
              ) : (
                <div
                  key={message.id}
                  className="message-row ai-row"
                >
                  <div
                    className={
                      message.isError
                        ? "ai-content is-error"
                        : "ai-content"
                    }
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {message.text || ""}
                    </ReactMarkdown>
                  </div>
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


        {/* =============================================
            COMPOSER — OUTSIDE THE SCROLL CONTAINER
            ============================================= */}

        <div className="composer-area">

          {selectedFile && (
            <div className="composer-file-preview">

              {imagePreview && (
                <img
                  src={imagePreview}
                  alt={selectedFile.name}
                  className="composer-preview-image"
                />
              )}

              <div className="composer-file-info">

                <strong>{selectedFile.name}</strong>

                <span>
                  {selectedFile.type.startsWith("image/")
                    ? "Image"
                    : "File"}
                  {" · "}
                  {formatFileSize(selectedFile.size)}
                </span>

              </div>

              <button
                type="button"
                onClick={removeSelectedFile}
                className="remove-file"
                aria-label="Remove attachment"
              >
                ×
              </button>

            </div>
          )}

          {attachmentNotice && (
            <div className="composer-notice" role="status">
              {attachmentNotice}
            </div>
          )}


          <form
            className="composer"
            onSubmit={handleComposerSubmit}
          >

            {/* Hidden, untabbable and never a submit target, so
                nothing but the attach button can open it. */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden-file-input"
              onChange={handleFileSelect}
              accept={IMAGE_ACCEPT}
              tabIndex={-1}
            />

            <button
              type="button"
              className="composer-plus"
              onClick={openFilePicker}
              disabled={loading}
              title="Attach an image"
              aria-label="Attach an image"
            >
              <AttachIcon />
            </button>

            <input
              ref={composerInputRef}
              type="text"
              className="composer-input"
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              disabled={loading}
              placeholder={config.placeholder}
              aria-label={`Message ${config.name}`}
              autoComplete="off"
            />

            <button
              type="submit"
              className="composer-send"
              disabled={!canSend}
              title={loading ? "Waiting for a reply" : "Send"}
              aria-label="Send message"
            >
              <SendIcon />
            </button>

          </form>

          <div className="composer-disclaimer">
            {config.disclaimer ??
              `${config.name} can make mistakes. Check important information.`}
          </div>

        </div>

      </main>

    </div>
  );
}

export default AgentChat;
