import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  Image as ImageIcon,
  Heart,
  MessageCircle,
  Send,
  MoreHorizontal,
  Globe2,
  Home,
  Package,
  Users,
  Inbox as InboxIcon,
  Plus,
  X,
  Check,
  Pencil,
  LogOut,
  Trash2,
  Bookmark,
  Share2,
  Download,
  UserPlus,
  MessageSquare,
  RefreshCw,
  Camera,
  User,
  Save,
  ArrowLeft,
} from "lucide-react";

/*
===========================================================
CAREBOX COMMUNITY — SINGLE FILE, PRODUCTION-READY FRONTEND
===========================================================

Expected backend API:
  GET    /feed?limit=20&cursor=...
  POST   /posts                         multipart/form-data
  DELETE /posts/:id
  POST   /posts/:id/like                { liked: boolean }
  GET    /posts/:id/comments
  POST   /posts/:id/comments            { content: string }
  POST   /posts/:id/save                { saved: boolean }
  PATCH  /users/me                      multipart/form-data
  GET    /users                          { users: [...] }  <-- all platform users
  GET    /conversations
  POST   /conversations                 { participantId }
  GET    /conversations/:id/messages
  POST   /conversations/:id/messages    { content }
  GET    /notifications?limit=30
  PATCH  /notifications/read-all

IMPORTANT:
- MongoDB/cloud persistence is performed by the backend.
- LocalStorage is used only as a resilient UI cache/offline fallback.
- Profile images and post images should be stored by the backend in
  cloud/object storage, not in MongoDB as binary data.
*/

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const STORAGE = {
  USER: "carebox_user",
  TOKEN: "token",
  POSTS: "carebox_posts_cache",
  SAVED: "carebox_saved_posts",
  SEARCHES: "carebox_recent_searches",
  LOCAL_POSTS: "carebox_local_posts",
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const POST_TEXT_LIMIT = 5000;
const POST_TITLE_LIMIT = 160;

/* =========================================================
   HELPERS
   ========================================================= */

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private/restricted browser contexts.
  }
};

const getToken = () => {
  try {
    return localStorage.getItem(STORAGE.TOKEN) || "";
  } catch {
    return "";
  }
};

const idOf = (item) =>
  item?.id || item?._id || item?.userId || item?.user?.id || "";

const userEmailLocalPart = (email = "") =>
  String(email).split("@")[0].trim();

const makeUsernameFromEmail = (email = "") => {
  const local = userEmailLocalPart(email)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");

  return local || "user";
};

/*
  The avatar is intentionally derived from the email when no uploaded
  profile image exists. It uses the FIRST LETTER of the email address,
  exactly as requested.
*/
const firstEmailLetter = (email = "") =>
  String(email).trim().charAt(0).toUpperCase() || "U";

const normalizeUser = (raw) => {
  if (!raw) return null;

  const email = raw.email || "";
  const generatedUsername = makeUsernameFromEmail(email);
  const username =
    String(raw.username || "").trim() || generatedUsername;

  const name =
    String(raw.name || "").trim() ||
    String(raw.fullName || "").trim() ||
    username;

  return {
    ...raw,
    id: raw.id || raw._id,
    _id: raw._id || raw.id,
    email,
    name,
    username,
    bio: raw.bio || "",
    avatar:
      raw.avatar ||
      raw.profilePicture ||
      raw.photoURL ||
      raw.image ||
      "",
    avatarLetter: firstEmailLetter(email),
    settings: raw.settings || {},
  };
};

const initialsFor = (user) => {
  if (user?.avatarLetter) return user.avatarLetter;

  const value =
    user?.email ||
    user?.username ||
    user?.name ||
    "U";

  return String(value).trim().charAt(0).toUpperCase() || "U";
};

const normalizePost = (raw) => {
  if (!raw) return null;

  const author = normalizeUser(
    raw.author ||
      raw.artist ||
      raw.owner ||
      raw.user ||
      {}
  );

  return {
    ...raw,
    id: raw.id || raw._id || `local-${Date.now()}-${Math.random()}`,
    _id: raw._id || raw.id,
    title: raw.title || "",
    description: raw.description || raw.content || "",
    image:
      raw.image ||
      raw.imageUrl ||
      raw.imageUrls?.optimized ||
      raw.imageUrls?.fullsize ||
      raw.mediaUrls?.optimized ||
      raw.mediaUrls?.fullsize ||
      "",
    attachment:
      raw.attachment ||
      raw.fileUrl ||
      raw.attachmentUrl ||
      "",
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    likeCount: Number(raw.likeCount || raw.likesCount || 0),
    commentCount: Number(raw.commentCount || raw.commentsCount || 0),
    shareCount: Number(raw.shareCount || 0),
    liked: Boolean(raw.liked || raw.likedByMe),
    saved: Boolean(raw.saved || raw.savedByMe),
    createdAt: raw.createdAt || new Date().toISOString(),
    author,
  };
};

const timeAgo = (date) => {
  if (!date) return "Just now";

  const value = new Date(date).getTime();
  if (Number.isNaN(value)) return "Just now";

  const diff = Math.max(0, Date.now() - value);
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(days / 365)}y ago`;
};

const isSameUser = (a, b) => {
  const aid = String(a?.id || a?._id || "");
  const bid = String(b?.id || b?._id || "");

  if (aid && bid && aid === bid) return true;

  return (
    String(a?.email || "").toLowerCase() ===
      String(b?.email || "").toLowerCase() &&
    Boolean(a?.email)
  );
};

/* =========================================================
   API
   ========================================================= */

const api = async (endpoint, options = {}) => {
  const authToken = getToken();

  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(authToken
      ? { Authorization: `Bearer ${authToken}` }
      : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    // Empty response is valid for some DELETE/PATCH endpoints.
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed (${response.status})`
    );
  }

  return data;
};

const extractArray = (data, keys = ["data"]) => {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  if (Array.isArray(data)) return data;

  return [];
};

/* =========================================================
   AVATAR
   ========================================================= */

function UserAvatar({
  user,
  size = 40,
  className = "",
}) {
  const normalized = normalizeUser(user);

  if (normalized?.avatar) {
    return (
      <img
        src={normalized.avatar}
        alt=""
        className={`avatar ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`avatar avatar-letter ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(12, size * 0.38),
      }}
      aria-label={`Profile avatar for ${
        normalized?.email || "user"
      }`}
    >
      {initialsFor(normalized)}
    </div>
  );
}

/* =========================================================
   MAIN APP
   ========================================================= */

export default function CareBoxCommunity() {
  const navigate = useNavigate();

  const [user, setUser] = useState(() =>
    normalizeUser(readJSON(STORAGE.USER, null))
  );

  const [activeView, setActiveView] = useState("community");
  const [showProfile, setShowProfile] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [toast, setToast] = useState("");

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(window.__careboxToastTimer);
    window.__careboxToastTimer = window.setTimeout(() => {
      setToast("");
    }, 2800);
  }, []);

  useEffect(() => {
    const stored = normalizeUser(readJSON(STORAGE.USER, null));
    if (stored) setUser(stored);
  }, []);

  const updateUser = useCallback((updated) => {
    const normalized = normalizeUser(updated);
    if (!normalized) return;
    setUser(normalized);
    writeJSON(STORAGE.USER, normalized);
  }, []);

  const logout = () => {
    localStorage.removeItem(STORAGE.TOKEN);
    localStorage.removeItem(STORAGE.USER);
    setUser(null);
    navigate("/login");
  };

  const go = (view) => {
    setActiveView(view);
    setShowProfile(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <style>{styles}</style>

      <div className="app-shell">
        <header className="topbar">
          <button
            className="brand"
            onClick={() => go("community")}
            aria-label="CareBox home"
          >
            <span className="brand-mark">C</span>
            <span>CareBox</span>
          </button>

          <div className="desktop-search">
            <Search size={17} />
            <input
              placeholder="Search CareBox..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const value = e.currentTarget.value.trim();
                  if (value) {
                    go("search");
                    window.dispatchEvent(
                      new CustomEvent("carebox-search", {
                        detail: value,
                      })
                    );
                  }
                }
              }}
            />
          </div>

          <div className="top-actions">
            <button
              className="top-icon mobile-search-button"
              onClick={() => go("search")}
              aria-label="Search"
            >
              <Search size={20} />
            </button>

            <button
              className="top-icon"
              onClick={() => go("notifications")}
              aria-label="Notifications"
            >
              <Bell size={20} />
            </button>

            <button
              className="profile-trigger"
              onClick={() =>
                setShowProfile((value) => !value)
              }
              aria-label="Open profile menu"
            >
              <UserAvatar user={user} size={35} />
            </button>
          </div>
        </header>

        {showProfile && (
          <div className="profile-dropdown">
            <div className="dropdown-user">
              <UserAvatar user={user} size={45} />
              <div>
                <strong>
                  {user?.name || user?.username || "User"}
                </strong>
                <span>
                  {user?.email || "Community member"}
                </span>
              </div>
            </div>

            <button onClick={() => go("profile")}>
              <User size={17} />
              Profile
            </button>

            <button onClick={() => go("settings")}>
              <Pencil size={17} />
              Account settings
            </button>

            <button className="danger" onClick={logout}>
              <LogOut size={17} />
              Log out
            </button>
          </div>
        )}

        <main className="page">
          {activeView === "community" && (
            <CommunityView
              user={user}
              notify={notify}
              onCreate={() => setShowCreatePost(true)}
            />
          )}

          {activeView === "home" && (
            <HomeView
              user={user}
              go={go}
            />
          )}

          {activeView === "products" && (
            <ProductsView
              user={user}
              notify={notify}
            />
          )}

          {activeView === "inbox" && (
            <InboxView
              user={user}
              notify={notify}
            />
          )}

          {activeView === "profile" && (
            <ProfileView
              user={user}
              setUser={updateUser}
              notify={notify}
            />
          )}

          {activeView === "settings" && (
            <SettingsView
              user={user}
              setUser={updateUser}
              notify={notify}
              logout={logout}
            />
          )}

          {activeView === "notifications" && (
            <NotificationsView
              notify={notify}
            />
          )}

          {activeView === "search" && (
            <SearchView
              user={user}
              notify={notify}
            />
          )}
        </main>

        <nav className="bottom-nav">
          <NavItem
            active={activeView === "home"}
            icon={<Home size={21} />}
            label="Home"
            onClick={() => go("home")}
          />

          <NavItem
            active={activeView === "products"}
            icon={<Package size={21} />}
            label="Product"
            onClick={() => go("products")}
          />

          <NavItem
            active={activeView === "community"}
            icon={<Users size={21} />}
            label="Community"
            onClick={() => go("community")}
          />

          <NavItem
            active={activeView === "inbox"}
            icon={<InboxIcon size={21} />}
            label="Inbox"
            onClick={() => go("inbox")}
          />
        </nav>

        <button
          className="fab"
          onClick={() => setShowCreatePost(true)}
          aria-label="Create post"
        >
          <Plus size={27} />
        </button>

        {showCreatePost && (
          <CreatePostModal
            user={user}
            notify={notify}
            onClose={() => setShowCreatePost(false)}
          />
        )}

        {toast && (
          <div className="toast" role="status">
            <Check size={16} />
            {toast}
          </div>
        )}
      </div>
    </>
  );
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function NavItem({
  active,
  icon,
  label,
  onClick,
}) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* =========================================================
   COMMUNITY
   ========================================================= */

function CommunityView({
  user,
  notify,
  onCreate,
}) {
  const [posts, setPosts] = useState(() =>
    readJSON(STORAGE.POSTS, []).map(normalizePost)
  );

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState("All Posts");

  useEffect(() => {
    const handleDeleted = (event) => {
      const deletedId = String(event.detail || "");

      setPosts((previous) =>
        previous.filter(
          (post) => String(post.id) !== deletedId
        )
      );

      const cached = readJSON(STORAGE.POSTS, []);
      writeJSON(
        STORAGE.POSTS,
        cached.filter(
          (post) => String(idOf(post)) !== deletedId
        )
      );
    };

    window.addEventListener(
      "carebox-post-deleted",
      handleDeleted
    );

    return () =>
      window.removeEventListener(
        "carebox-post-deleted",
        handleDeleted
      );
  }, []);
  const [query, setQuery] = useState("");
  const sentinel = useRef(null);

  const load = useCallback(
    async (cursorValue = null) => {
      if (cursorValue) setLoadingMore(true);
      else setLoading(true);

      try {
        const endpoint = cursorValue
          ? `/feed?cursor=${encodeURIComponent(
              cursorValue
            )}&limit=20`
          : "/feed?limit=20";

        const data = await api(endpoint);

        const incoming = extractArray(data).map(normalizePost);

        setPosts((previous) => {
          if (!cursorValue) return incoming;

          const ids = new Set(
            previous.map((post) => String(post.id))
          );

          return [
            ...previous,
            ...incoming.filter(
              (post) => !ids.has(String(post.id))
            ),
          ];
        });

        setCursor(
          data?.pagination?.nextCursor || null
        );
        setHasMore(
          Boolean(data?.pagination?.hasMore)
        );

        writeJSON(
          STORAGE.POSTS,
          cursorValue
            ? [...readJSON(STORAGE.POSTS, []), ...incoming]
            : incoming
        );
      } catch (error) {
        console.warn("Feed unavailable:", error);

        if (!cursorValue) {
          const cached = readJSON(
            STORAGE.POSTS,
            []
          ).map(normalizePost);

          const localDrafts = readJSON(
            STORAGE.LOCAL_POSTS,
            []
          ).map(normalizePost);

          const combined = [
            ...localDrafts,
            ...cached,
          ];

          const unique = [];
          const ids = new Set();

          for (const post of combined) {
            if (!post) continue;
            const key = String(post.id);
            if (ids.has(key)) continue;
            ids.add(key);
            unique.push(post);
          }

          setPosts(unique);

          if (!unique.length) {
            notify(
              "Feed unavailable. You can still create a post when the server is reachable."
            );
          }
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    load();

    const refresh = () => load();

    window.addEventListener(
      "carebox-refresh",
      refresh
    );

    return () =>
      window.removeEventListener(
        "carebox-refresh",
        refresh
      );
  }, [load]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasMore &&
          !loadingMore
        ) {
          load(cursor);
        }
      },
      { rootMargin: "500px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, hasMore, loadingMore, load]);

  const filtered = useMemo(() => {
    return posts.filter((post) => {
      const searchable =
        `${post.title} ${post.description} ${post.tags.join(
          " "
        )}`.toLowerCase();

      const matchesQuery =
        !query.trim() ||
        searchable.includes(
          query.trim().toLowerCase()
        );

      if (!matchesQuery) return false;

      if (category === "All Posts") return true;

      return post.tags.some(
        (tag) =>
          String(tag).toLowerCase() ===
          category.toLowerCase()
      );
    });
  }, [posts, query, category]);

  const handleCreated = (post) => {
    const normalized = normalizePost(post);

    if (!normalized) return;

    setPosts((previous) => [
      normalized,
      ...previous.filter(
        (item) =>
          String(item.id) !==
          String(normalized.id)
      ),
    ]);

    writeJSON(STORAGE.POSTS, [
      normalized,
      ...readJSON(STORAGE.POSTS, []).filter(
        (item) =>
          String(idOf(item)) !==
          String(normalized.id)
      ),
    ]);
  };

  return (
    <section className="community-page">
      <section className="community-mobile-header">
        <div>
          <span className="eyebrow">COMMUNITY</span>
          <h1>CareBox Community</h1>
        </div>

        <button
          className="mobile-refresh"
          onClick={() => load()}
          aria-label="Refresh community"
        >
          <RefreshCw size={18} />
        </button>
      </section>

      <section className="composer">
        <UserAvatar user={user} size={40} />

        <button
          className="mind-input"
          onClick={onCreate}
        >
          What's on your mind?
        </button>

        <button
          className="gallery-button"
          onClick={onCreate}
          aria-label="Add image"
        >
          <ImageIcon size={21} />
        </button>
      </section>

      <div className="community-tools">
        <div className="community-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) =>
              setQuery(e.target.value)
            }
            placeholder="Search posts..."
          />
        </div>

        <div className="category-scroll">
          {[
            "All Posts",
            "Donate",
            "Sell",
            "Buy",
            "Jobs",
            "Education",
          ].map((item) => (
            <button
              key={item}
              className={`category-pill ${
                category === item ? "active" : ""
              }`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <PostSkeletons />
      ) : filtered.length ? (
        <div className="feed">
          {filtered.map((post) => (
            <CommunityPost
              key={post.id}
              post={post}
              user={user}
              notify={notify}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Users size={31} />}
          title={
            query
              ? "No matching posts"
              : "No posts yet"
          }
          description={
            query
              ? "Try another search."
              : "Be the first person to share something with the community."
          }
          action={
            !query && (
              <button
                className="primary-button"
                onClick={onCreate}
              >
                <Plus size={16} />
                Create post
              </button>
            )
          }
        />
      )}

      <div
        ref={sentinel}
        className="feed-end"
      >
        {loadingMore && (
          <span>Loading more...</span>
        )}
        {!hasMore && posts.length > 0 && (
          <span>You're all caught up.</span>
        )}
      </div>

      <div className="sr-only">
        {posts.length} posts loaded
      </div>

      {/* The callback is intentionally retained for newly-created posts
          by listening to this event from the modal. */}
      <PostCreationBridge
        onCreated={handleCreated}
      />
    </section>
  );
}

/* =========================================================
   POST CREATION BRIDGE
   ========================================================= */

function PostCreationBridge({ onCreated }) {
  useEffect(() => {
    const handler = (event) => {
      if (event.detail) onCreated(event.detail);
    };

    window.addEventListener(
      "carebox-post-created",
      handler
    );

    return () =>
      window.removeEventListener(
        "carebox-post-created",
        handler
      );
  }, [onCreated]);

  return null;
}

/* =========================================================
   COMMUNITY POST
   ========================================================= */

function CommunityPost({
  post,
  user,
  notify,
}) {
  const [liked, setLiked] = useState(
    Boolean(post.liked)
  );
  const [likeCount, setLikeCount] = useState(
    Number(post.likeCount || 0)
  );
  const [commentCount, setCommentCount] =
    useState(Number(post.commentCount || 0));
  const [shareCount, setShareCount] =
    useState(Number(post.shareCount || 0));

  const [saved, setSaved] = useState(() => {
    const map = readJSON(STORAGE.SAVED, {});
    return Boolean(
      post.saved || map[String(post.id)]
    );
  });

  const [comments, setComments] = useState([]);
  const [commentOpen, setCommentOpen] =
    useState(false);
  const [commentText, setCommentText] =
    useState("");
  const [expanded, setExpanded] =
    useState(false);
  const [menuOpen, setMenuOpen] =
    useState(false);
  const [busy, setBusy] = useState(false);

  const text = post.description || "";
  const long = text.length > 280;
  const displayText =
    !long || expanded
      ? text
      : `${text.slice(0, 280)}...`;

  const author = normalizeUser(post.author);
  const owner = isSameUser(author, user);

  const loadComments = async () => {
    try {
      const data = await api(
        `/posts/${post.id}/comments`
      );
      setComments(
        extractArray(data).map((comment) => ({
          ...comment,
          author: normalizeUser(
            comment.author ||
              comment.user ||
              comment.owner
          ),
        }))
      );
    } catch {
      notify("Could not load comments");
    }
  };

  const toggleLike = async () => {
    const next = !liked;

    setLiked(next);
    setLikeCount((value) =>
      Math.max(0, value + (next ? 1 : -1))
    );

    try {
      await api(`/posts/${post.id}/like`, {
        method: "POST",
        body: JSON.stringify({
          liked: next,
        }),
      });
    } catch {
      setLiked(!next);
      setLikeCount((value) =>
        Math.max(
          0,
          value + (next ? -1 : 1)
        )
      );
      notify("Could not update like");
    }
  };

  const toggleComments = async () => {
    const next = !commentOpen;
    setCommentOpen(next);

    if (next) {
      await loadComments();
    }
  };

  const addComment = async () => {
    const value = commentText.trim();
    if (!value || busy) return;

    setBusy(true);

    const optimistic = {
      id: `temp-${Date.now()}`,
      content: value,
      createdAt: new Date().toISOString(),
      author: user,
    };

    setComments((items) => [
      ...items,
      optimistic,
    ]);
    setCommentText("");
    setCommentCount((count) => count + 1);

    try {
      const data = await api(
        `/posts/${post.id}/comments`,
        {
          method: "POST",
          body: JSON.stringify({
            content: value,
          }),
        }
      );

      const saved =
        data?.data || data?.comment;

      if (saved) {
        setComments((items) =>
          items.map((item) =>
            item.id === optimistic.id
              ? {
                  ...saved,
                  author: normalizeUser(
                    saved.author ||
                      saved.user ||
                      user
                  ),
                }
              : item
          )
        );
      }
    } catch {
      setComments((items) =>
        items.filter(
          (item) =>
            item.id !== optimistic.id
        )
      );
      setCommentCount((count) =>
        Math.max(0, count - 1)
      );
      notify("Comment could not be saved");
    } finally {
      setBusy(false);
    }
  };

  const toggleSave = async () => {
    const next = !saved;

    setSaved(next);

    const map = readJSON(
      STORAGE.SAVED,
      {}
    );

    if (next) map[String(post.id)] = true;
    else delete map[String(post.id)];

    writeJSON(STORAGE.SAVED, map);

    try {
      await api(`/posts/${post.id}/save`, {
        method: "POST",
        body: JSON.stringify({
          saved: next,
        }),
      });

      notify(
        next
          ? "Post saved"
          : "Post removed from saved"
      );
    } catch {
      notify(
        next
          ? "Saved locally; server could not be reached"
          : "Removed locally"
      );
    }
  };

  const sharePost = async () => {
    const shareData = {
      title:
        post.title ||
        "CareBox Community post",
      text: text || post.title || "",
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(
          window.location.href
        );
        notify("Post link copied");
      }

      setShareCount((count) => count + 1);

      api(`/posts/${post.id}/share`, {
        method: "POST",
      }).catch(() => {});
    } catch (error) {
      if (error?.name !== "AbortError") {
        notify("Could not share post");
      }
    }
  };

  const deletePost = async () => {
    if (!owner) return;

    const confirmed = window.confirm(
      "Delete this post permanently?"
    );

    if (!confirmed) return;

    try {
      await api(`/posts/${post.id}`, {
        method: "DELETE",
      });

      window.dispatchEvent(
        new CustomEvent(
          "carebox-post-deleted",
          {
            detail: post.id,
          }
        )
      );

      notify("Post deleted");
    } catch {
      notify("Could not delete post");
    }
  };

  const savePostAsImage = async () => {
    try {
      const element = document.getElementById(
        `post-${post.id}`
      );

      if (!element) {
        notify("Post image could not be prepared");
        return;
      }

      /*
        Uses browser canvas APIs without requiring html2canvas.
        Images are loaded with CORS enabled when possible.
        If the remote server blocks CORS, the text-only export still
        works, while the original post image remains available in the UI.
      */
      const canvas = await renderPostToCanvas(
        element
      );

      const blob = await new Promise(
        (resolve) =>
          canvas.toBlob(
            resolve,
            "image/png",
            0.95
          )
      );

      if (!blob) {
        throw new Error("Canvas export failed");
      }

      const file = new File(
        [blob],
        `carebox-post-${post.id}.png`,
        { type: "image/png" }
      );

      if (
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title:
            post.title ||
            "CareBox Community",
          files: [file],
        });
        notify("Post image ready to share");
        return;
      }

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download = `carebox-post-${post.id}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      notify("Post saved as PNG");
    } catch (error) {
      console.error(error);
      notify(
        "Image export failed. Try again or allow image loading."
      );
    }
  };

  /*
    Deletion is broadcast to CommunityView so React removes the post from
    state rather than only removing its DOM node. This keeps the UI and
    persistent feed cache consistent.
  */

  return (
    <article
      id={`post-${post.id}`}
      className="post"
    >
      <div className="post-head">
        <UserAvatar
          user={author}
          size={42}
        />

        <div className="post-author">
          <strong>
            {author?.name ||
              author?.username ||
              "Community member"}
          </strong>

          <span>
            {timeAgo(post.createdAt)}
            {" · "}
            <Globe2
              size={10}
              style={{
                display: "inline",
                verticalAlign: "middle",
              }}
            />
            {" Public"}
          </span>
        </div>

        <button
          className="more"
          onClick={() =>
            setMenuOpen((value) => !value)
          }
          aria-label="Post options"
        >
          <MoreHorizontal size={20} />
        </button>

        {menuOpen && (
          <div className="post-menu">
            <button
              onClick={() => {
                toggleSave();
                setMenuOpen(false);
              }}
            >
              <Bookmark
                size={16}
                fill={
                  saved
                    ? "currentColor"
                    : "none"
                }
              />
              {saved
                ? "Unsave post"
                : "Save post"}
            </button>

            <button
              onClick={() => {
                savePostAsImage();
                setMenuOpen(false);
              }}
            >
              <Download size={16} />
              Save as image
            </button>

            <button
              onClick={() => {
                sharePost();
                setMenuOpen(false);
              }}
            >
              <Share2 size={16} />
              Reshare / share
            </button>

            {owner && (
              <button
                className="danger"
                onClick={() => {
                  setMenuOpen(false);
                  deletePost();
                }}
              >
                <Trash2 size={16} />
                Delete post
              </button>
            )}
          </div>
        )}
      </div>

      {(post.title || text) && (
        <div className="post-body">
          {post.title && (
            <h3>{post.title}</h3>
          )}

          {text && (
            <p>
              {displayText}

              {long && (
                <button
                  className="see-more"
                  onClick={() =>
                    setExpanded(
                      (value) => !value
                    )
                  }
                >
                  {expanded
                    ? " See less"
                    : " See more"}
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {post.image && (
        <div className="post-image">
          <img
            src={post.image}
            alt={
              post.title ||
              "Community post"
            }
            loading="lazy"
            crossOrigin="anonymous"
          />
        </div>
      )}

      {post.attachment && (
        <a
          className="post-attachment"
          href={post.attachment}
          target="_blank"
          rel="noreferrer"
        >
          <Download size={16} />
          Open attachment
        </a>
      )}

      {post.tags.length > 0 && (
        <div className="tags">
          {post.tags.map(
            (tag, index) => (
              <span
                key={`${tag}-${index}`}
              >
                #{tag}
              </span>
            )
          )}
        </div>
      )}

      <div className="engagement-row">
        <span className="engagement-like">
          <Heart
            size={12}
            fill="currentColor"
          />
          {likeCount}
        </span>

        <span>
          {commentCount}{" "}
          {commentCount === 1
            ? "comment"
            : "comments"}
          {shareCount > 0 &&
            ` · ${shareCount} shares`}
        </span>
      </div>

      <div className="post-actions">
        <button
          className={liked ? "liked" : ""}
          onClick={toggleLike}
        >
          <Heart
            size={18}
            fill={
              liked
                ? "currentColor"
                : "none"
            }
          />
          Like
        </button>

        <button
          className={
            commentOpen
              ? "active"
              : ""
          }
          onClick={toggleComments}
        >
          <MessageCircle size={18} />
          Comment
        </button>

        <button onClick={sharePost}>
          <Send size={18} />
          Share
        </button>
      </div>

      {commentOpen && (
        <div className="comments">
          {comments.map((comment) => (
            <div
              className="comment"
              key={comment.id || comment._id}
            >
              <UserAvatar
                user={comment.author}
                size={30}
              />

              <div className="comment-bubble">
                <strong>
                  {comment.author?.name ||
                    comment.author?.username ||
                    "User"}
                </strong>

                <p>
                  {comment.content}
                </p>

                <span>
                  {timeAgo(
                    comment.createdAt
                  )}
                </span>
              </div>
            </div>
          ))}

          {!comments.length && (
            <div className="no-comments">
              No comments yet.
            </div>
          )}

          <div className="comment-compose">
            <UserAvatar
              user={user}
              size={31}
            />

            <input
              value={commentText}
              onChange={(e) =>
                setCommentText(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addComment();
                }
              }}
              placeholder="Write a comment..."
            />

            <button
              onClick={addComment}
              disabled={busy}
              aria-label="Send comment"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/* =========================================================
   CREATE POST
   ========================================================= */

function CreatePostModal({
  user,
  notify,
  onClose,
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");
  const [tags, setTags] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] =
    useState("");
  const [saving, setSaving] =
    useState(false);
  const [error, setError] = useState("");

  const fileRef = useRef(null);

  const selectImage = (event) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(
        "Please select a valid image file."
      );
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setError(
        "Image must be smaller than 10MB."
      );
      return;
    }

    setError("");
    setImage(file);

    const reader = new FileReader();

    reader.onload = () =>
      setPreview(
        String(reader.result || "")
      );

    reader.readAsDataURL(file);
  };

  const submit = async (event) => {
    event.preventDefault();

    const cleanTitle = title.trim();
    const cleanDescription =
      description.trim();

    if (
      !cleanTitle &&
      !cleanDescription &&
      !image
    ) {
      setError(
        "Add text or an image before publishing."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const form =
        new FormData();

      if (cleanTitle) {
        form.append(
          "title",
          cleanTitle.slice(
            0,
            POST_TITLE_LIMIT
          )
        );
      }

      if (cleanDescription) {
        form.append(
          "description",
          cleanDescription.slice(
            0,
            POST_TEXT_LIMIT
          )
        );
      }

      /*
        Image is OPTIONAL. No empty image field is sent.
      */
      if (image) {
        form.append("image", image);
      }

      form.append(
        "tags",
        JSON.stringify(
          tags
            .split(",")
            .map((tag) =>
              tag.trim()
            )
            .filter(Boolean)
        )
      );

      const response =
        await api("/posts", {
          method: "POST",
          body: form,
        });

      const serverPost =
        response?.data ||
        response?.post;

      /*
        Server response is authoritative. This is what makes the
        post persistent across sessions/devices when the backend
        stores it in MongoDB and the image in object storage.
      */
      const fallbackPost = {
        id: `local-${Date.now()}`,
        title: cleanTitle,
        description:
          cleanDescription,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        image: preview,
        author: user,
        createdAt:
          new Date().toISOString(),
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
      };

      const created =
        normalizePost(
          serverPost ||
            fallbackPost
        );

      if (created) {
        window.dispatchEvent(
          new CustomEvent(
            "carebox-post-created",
            {
              detail: created,
            }
          )
        );
      }

      /*
        Remove any offline draft that has the same title/content after a
        successful server publication, preventing duplicate display.
      */
      const offlineDrafts = readJSON(
        STORAGE.LOCAL_POSTS,
        []
      );

      writeJSON(
        STORAGE.LOCAL_POSTS,
        offlineDrafts.filter(
          (draft) =>
            !(
              String(draft?.title || "") ===
                String(created?.title || "") &&
              String(draft?.description || "") ===
                String(created?.description || "")
            )
        )
      );

      notify("Post published successfully");
      onClose();
    } catch (error) {
      console.error(error);

      /*
        Do NOT pretend localStorage is cloud persistence.
        If the API is unavailable, preserve a local draft so the
        user's work is not lost and clearly tell them it is local.
      */
      const localDraft = normalizePost({
        id: `offline-${Date.now()}`,
        title: cleanTitle,
        description:
          cleanDescription,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        image: preview,
        author: user,
        createdAt:
          new Date().toISOString(),
        likeCount: 0,
        commentCount: 0,
      });

      const drafts = readJSON(
        STORAGE.LOCAL_POSTS,
        []
      );

      writeJSON(
        STORAGE.LOCAL_POSTS,
        [localDraft, ...drafts]
      );

      setError(
        `${error.message}. The post was saved only on this device and must be published again when the server is available.`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className="modal create-post-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create post"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              COMMUNITY
            </span>
            <h2>Create post</h2>
            <p>
              Share something with the community.
            </p>
          </div>

          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <form
          className="modal-form"
          onSubmit={submit}
        >
          <div
            className="image-picker"
            onClick={() =>
              fileRef.current?.click()
            }
          >
            {preview ? (
              <img
                src={preview}
                alt="Selected preview"
              />
            ) : (
              <>
                <ImageIcon size={30} />
                <strong>
                  Add a photo
                </strong>
                <span>
                  Optional · up to 10MB
                </span>
              </>
            )}
          </div>

          <input
            ref={fileRef}
            hidden
            type="file"
            accept="image/*"
            onChange={selectImage}
          />

          <input
            className="form-input"
            value={title}
            onChange={(e) =>
              setTitle(e.target.value)
            }
            placeholder="Post title (optional)"
            maxLength={POST_TITLE_LIMIT}
          />

          <textarea
            className="form-input textarea"
            value={description}
            onChange={(e) =>
              setDescription(
                e.target.value
              )
            }
            placeholder="What's on your mind?"
            maxLength={POST_TEXT_LIMIT}
          />

          <input
            className="form-input"
            value={tags}
            onChange={(e) =>
              setTags(e.target.value)
            }
            placeholder="Tags: donate, education, jobs"
          />

          <div className="modal-user">
            <UserAvatar
              user={user}
              size={36}
            />

            <div>
              <strong>
                {user?.name ||
                  user?.username ||
                  "You"}
              </strong>
              <span>
                @{user?.username ||
                  makeUsernameFromEmail(
                    user?.email
                  )}
              </span>
            </div>
          </div>

          <button
            className="primary-button full"
            disabled={saving}
          >
            {saving
              ? "Publishing..."
              : "Publish post"}
          </button>
        </form>
      </section>
    </div>
  );
}

/* =========================================================
   PROFILE
   ========================================================= */

function ProfileView({
  user,
  setUser,
  notify,
}) {
  const [editing, setEditing] =
    useState(false);

  const [name, setName] =
    useState(user?.name || "");

  const [username, setUsername] =
    useState(
      user?.username ||
        makeUsernameFromEmail(
          user?.email
        )
    );

  const [bio, setBio] =
    useState(user?.bio || "");

  const [file, setFile] =
    useState(null);

  const [preview, setPreview] =
    useState(user?.avatar || "");

  const [saving, setSaving] =
    useState(false);

  const fileRef = useRef(null);

  useEffect(() => {
    setName(user?.name || "");
    setUsername(
      user?.username ||
        makeUsernameFromEmail(
          user?.email
        )
    );
    setBio(user?.bio || "");
    setPreview(user?.avatar || "");
  }, [user]);

  const chooseAvatar = (event) => {
    const selected =
      event.target.files?.[0];

    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      notify(
        "Please select an image."
      );
      return;
    }

    if (selected.size > MAX_IMAGE_BYTES) {
      notify(
        "Profile image must be smaller than 10MB."
      );
      return;
    }

    setFile(selected);

    const reader = new FileReader();

    reader.onload = () =>
      setPreview(
        String(reader.result || "")
      );

    reader.readAsDataURL(selected);
  };

  const saveProfile = async () => {
    const cleanName =
      name.trim() ||
      makeUsernameFromEmail(
        user?.email
      );

    const cleanUsername =
      username
        .trim()
        .toLowerCase()
        .replace(
          /[^a-z0-9._-]/g,
          ""
        ) ||
      makeUsernameFromEmail(
        user?.email
      );

    setSaving(true);

    try {
      const form =
        new FormData();

      form.append("name", cleanName);
      form.append(
        "username",
        cleanUsername
      );
      form.append(
        "bio",
        bio.trim()
      );

      if (file) {
        form.append(
          "avatar",
          file
        );
      }

      const response =
        await api("/users/me", {
          method: "PATCH",
          body: form,
        });

      const updated =
        normalizeUser(
          response?.data ||
            response?.user
        );

      const finalUser =
        updated ||
        normalizeUser({
          ...user,
          name: cleanName,
          username: cleanUsername,
          bio: bio.trim(),
          avatar:
            preview ||
            user?.avatar ||
            "",
        });

      setUser(finalUser);
      setEditing(false);
      setFile(null);

      /*
        carebox_user is updated immediately and the backend has already
        persisted the profile. This means the edited profile remains after
        logout/login and across devices once the backend returns it.
      */
      writeJSON(
        STORAGE.USER,
        finalUser
      );

      notify(
        "Profile saved permanently"
      );
    } catch (error) {
      /*
        Keep the local profile as a fallback, but explicitly distinguish
        it from cloud persistence.
      */
      const fallback =
        normalizeUser({
          ...user,
          name:
            name.trim() ||
            makeUsernameFromEmail(
              user?.email
            ),
          username:
            username.trim() ||
            makeUsernameFromEmail(
              user?.email
            ),
          bio: bio.trim(),
          avatar:
            preview ||
            user?.avatar ||
            "",
        });

      setUser(fallback);
      writeJSON(
        STORAGE.USER,
        fallback
      );

      notify(
        `Profile saved on this device. Server unavailable: ${error.message}`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="content-view profile-page">
      <div className="profile-cover" />

      <div className="profile-card">
        <div className="profile-avatar-wrap">
          {preview ? (
            <img
              src={preview}
              alt=""
              className="profile-avatar-large"
            />
          ) : (
            <div className="profile-avatar-large profile-avatar-letter">
              {initialsFor(user)}
            </div>
          )}

          {editing && (
            <button
              className="avatar-edit"
              onClick={() =>
                fileRef.current?.click()
              }
              aria-label="Change profile photo"
            >
              <Camera size={15} />
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          hidden
          type="file"
          accept="image/*"
          onChange={chooseAvatar}
        />

        <div className="profile-heading-row">
          <div>
            <h1>
              {user?.name ||
                user?.username ||
                "User"}
            </h1>

            <span>
              @
              {user?.username ||
                makeUsernameFromEmail(
                  user?.email
                )}
            </span>
          </div>

          {!editing && (
            <button
              className="secondary-button"
              onClick={() =>
                setEditing(true)
              }
            >
              <Pencil size={16} />
              Edit profile
            </button>
          )}
        </div>

        {editing ? (
          <div className="profile-form">
            <label>
              Full name
              <input
                className="form-input"
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Username
              <input
                className="form-input"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Bio
              <textarea
                className="form-input textarea"
                value={bio}
                onChange={(e) =>
                  setBio(
                    e.target.value
                  )
                }
                placeholder="Tell the community about yourself"
              />
            </label>

            <div className="profile-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  setEditing(false)
                }
              >
                Cancel
              </button>

              <button
                className="primary-button"
                disabled={saving}
                onClick={saveProfile}
              >
                <Save size={16} />
                {saving
                  ? "Saving..."
                  : "Save profile"}
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-info">
            <p>
              {user?.bio ||
                "No bio added yet."}
            </p>

            <span>
              {user?.email}
            </span>
          </div>
        )}

        <div className="profile-stats">
          <div>
            <strong>
              {user?.postCount || 0}
            </strong>
            <span>Posts</span>
          </div>

          <div>
            <strong>
              {user?.followersCount || 0}
            </strong>
            <span>Followers</span>
          </div>

          <div>
            <strong>
              {user?.followingCount || 0}
            </strong>
            <span>Following</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   INBOX — ALL PLATFORM USERS + CONVERSATIONS
   ========================================================= */

function InboxView({
  user,
  notify,
}) {
  const [mode, setMode] =
    useState("conversations");

  const [conversations, setConversations] =
    useState([]);

  const [users, setUsers] =
    useState([]);

  const [activeConversation, setActiveConversation] =
    useState(null);

  const [messages, setMessages] =
    useState([]);

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [usersLoading, setUsersLoading] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [sending, setSending] =
    useState(false);

  const loadConversations =
    useCallback(async () => {
      try {
        const data =
          await api("/conversations");

        setConversations(
          extractArray(data)
        );
      } catch (error) {
        console.warn(
          "Conversations unavailable:",
          error
        );
      } finally {
        setLoading(false);
      }
    }, []);

  const loadUsers =
    useCallback(async () => {
      setUsersLoading(true);

      try {
        /*
          Preferred endpoint: GET /users?limit=100.
          This must be authorized server-side and must exclude sensitive
          fields such as password hashes.
        */
        const data =
          await api("/users?limit=100");

        const list =
          extractArray(data, [
            "users",
            "data",
          ]).map(normalizeUser);

        setUsers(
          list.filter(
            (candidate) =>
              !isSameUser(
                candidate,
                user
              )
          )
        );
      } catch (error) {
        /*
          Fallback to the existing search endpoint if /users has not yet
          been implemented by the backend.
        */
        try {
          const data =
            await api(
              "/search?q="
            );

          const list =
            data?.data?.users ||
            data?.users ||
            [];

          setUsers(
            list
              .map(normalizeUser)
              .filter(
                (candidate) =>
                  !isSameUser(
                    candidate,
                    user
                  )
              )
          );
        } catch {
          notify(
            "Unable to load platform users. Add GET /users to the backend."
          );
        }
      } finally {
        setUsersLoading(false);
      }
    }, [notify, user]);

  useEffect(() => {
    loadConversations();

    const timer =
      setInterval(
        loadConversations,
        15000
      );

    return () =>
      clearInterval(timer);
  }, [loadConversations]);

  const openConversation =
    async (conversation) => {
      setActiveConversation(
        conversation
      );
      setMode("conversations");

      const conversationId =
        idOf(conversation);

      if (!conversationId) return;

      try {
        const data =
          await api(
            `/conversations/${conversationId}/messages`
          );

        setMessages(
          extractArray(data)
        );
      } catch {
        setMessages([]);
        notify(
          "Could not load messages"
        );
      }
    };

  const startConversation =
    async (person) => {
      const participantId =
        idOf(person);

      if (!participantId) {
        notify(
          "This user has no valid account ID."
        );
        return;
      }

      try {
        /*
          The backend should return the existing conversation when one
          already exists, otherwise create a new one.
        */
        const data =
          await api(
            "/conversations",
            {
              method: "POST",
              body: JSON.stringify({
                participantId,
              }),
            }
          );

        const conversation =
          data?.data ||
          data?.conversation;

        if (conversation) {
          setConversations(
            (previous) => {
              const cid =
                String(
                  idOf(
                    conversation
                  )
                );

              const without =
                previous.filter(
                  (item) =>
                    String(
                      idOf(item)
                    ) !== cid
                );

              return [
                conversation,
                ...without,
              ];
            }
          );

          await openConversation(
            conversation
          );
        }

        notify(
          `Conversation with ${
            person.name ||
            person.username
          } opened`
        );
      } catch (error) {
        notify(
          `Could not start conversation: ${error.message}`
        );
      }
    };

  const sendMessage =
    async () => {
      const text =
        message.trim();

      if (
        !text ||
        !activeConversation ||
        sending
      )
        return;

      const conversationId =
        idOf(activeConversation);

      if (!conversationId) return;

      setSending(true);

      const optimistic = {
        id: `temp-${Date.now()}`,
        content: text,
        text,
        sender: user,
        createdAt:
          new Date().toISOString(),
      };

      setMessages(
        (items) => [
          ...items,
          optimistic,
        ]
      );

      setMessage("");

      try {
        const data =
          await api(
            `/conversations/${conversationId}/messages`,
            {
              method: "POST",
              body: JSON.stringify({
                content: text,
              }),
            }
          );

        const saved =
          data?.data ||
          data?.message;

        if (saved) {
          setMessages(
            (items) =>
              items.map(
                (item) =>
                  item.id ===
                  optimistic.id
                    ? saved
                    : item
              )
          );
        }

        loadConversations();
      } catch {
        setMessages(
          (items) =>
            items.filter(
              (item) =>
                item.id !==
                optimistic.id
            )
        );

        notify(
          "Message could not be sent"
        );
      } finally {
        setSending(false);
      }
    };

  const filteredUsers =
    users.filter((candidate) => {
      const value =
        `${candidate.name} ${candidate.username} ${candidate.email}`
          .toLowerCase();

      return value.includes(
        search.trim().toLowerCase()
      );
    });

  return (
    <section className="content-view inbox-view">
      <div className="inbox-heading">
        <div>
          <span className="eyebrow">
            MESSAGES
          </span>
          <h1>Inbox</h1>
          <p>
            Chat privately with anyone who has an account on CareBox.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={() =>
            setMode(
              mode ===
                "people"
                ? "conversations"
                : "people"
            )
          }
        >
          {mode === "people"
            ? "Conversations"
            : "Start conversation"}
        </button>
      </div>

      <div className="inbox-layout">
        <aside className="conversation-panel">
          {mode === "people" ? (
            <>
              <div className="panel-title">
                <UserPlus size={17} />
                <strong>
                  People on CareBox
                </strong>
              </div>

              <div className="panel-search">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Find a person..."
                />
              </div>

              {usersLoading ? (
                <div className="loading-box">
                  Loading people...
                </div>
              ) : filteredUsers.length ? (
                filteredUsers.map(
                  (person) => (
                    <button
                      key={idOf(person)}
                      className="person-row"
                      onClick={() =>
                        startConversation(
                          person
                        )
                      }
                    >
                      <UserAvatar
                        user={person}
                        size={43}
                      />

                      <div>
                        <strong>
                          {person.name ||
                            person.username}
                        </strong>
                        <span>
                          @
                          {person.username ||
                            makeUsernameFromEmail(
                              person.email
                            )}
                        </span>
                      </div>

                      <MessageSquare
                        size={17}
                      />
                    </button>
                  )
                )
              ) : (
                <EmptyState
                  icon={<Users size={27} />}
                  title="No people found"
                  description="No other platform accounts match your search."
                />
              )}
            </>
          ) : (
            <>
              <div className="panel-title">
                <MessageSquare size={17} />
                <strong>
                  Conversations
                </strong>
              </div>

              {loading ? (
                <div className="loading-box">
                  Loading conversations...
                </div>
              ) : conversations.length ? (
                conversations.map(
                  (conversation) => {
                    const person =
                      normalizeUser(
                        conversation.otherUser ||
                          conversation.participant ||
                          conversation.user ||
                          {}
                      );

                    const cid =
                      idOf(
                        conversation
                      );

                    return (
                      <button
                        key={cid}
                        className={`conversation ${
                          idOf(
                            activeConversation
                          ) === cid
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          openConversation(
                            conversation
                          )
                        }
                      >
                        <UserAvatar
                          user={person}
                          size={43}
                        />

                        <div>
                          <strong>
                            {person.name ||
                              person.username ||
                              "User"}
                          </strong>

                          <p>
                            {conversation
                              .lastMessage
                              ?.content ||
                              "Start a conversation"}
                          </p>

                          <span>
                            {timeAgo(
                              conversation
                                .lastMessage
                                ?.createdAt
                            )}
                          </span>
                        </div>

                        {conversation.unreadCount >
                          0 && (
                          <b className="unread">
                            {
                              conversation.unreadCount
                            }
                          </b>
                        )}
                      </button>
                    );
                  }
                )
              ) : (
                <div className="empty-conversations">
                  <MessageSquare
                    size={30}
                  />
                  <strong>
                    No conversations
                  </strong>
                  <span>
                    Choose “Start conversation” to see all registered users.
                  </span>
                  <button
                    className="primary-button"
                    onClick={async () => {
                      setMode("people");
                      if (!users.length)
                        await loadUsers();
                    }}
                  >
                    Find people
                  </button>
                </div>
              )}
            </>
          )}
        </aside>

        <section className="chat-panel">
          {!activeConversation ? (
            <div className="chat-empty">
              <MessageSquare
                size={42}
              />
              <h3>
                Select a conversation
              </h3>
              <p>
                Or start a new conversation with any CareBox account.
              </p>

              <button
                className="primary-button"
                onClick={async () => {
                  setMode("people");
                  if (!users.length)
                    await loadUsers();
                }}
              >
                <UserPlus size={16} />
                Start conversation
              </button>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <button
                  className="chat-back"
                  onClick={() =>
                    setActiveConversation(
                      null
                    )
                  }
                  aria-label="Back"
                >
                  <ArrowLeft size={18} />
                </button>

                <UserAvatar
                  user={normalizeUser(
                    activeConversation.otherUser ||
                      activeConversation.participant
                  )}
                  size={39}
                />

                <div>
                  <strong>
                    {normalizeUser(
                      activeConversation.otherUser ||
                        activeConversation.participant
                    )?.name ||
                      "Conversation"}
                  </strong>

                  <span>
                    Private conversation
                  </span>
                </div>
              </div>

              <div className="messages">
                {messages.map(
                  (item) => {
                    const sender =
                      normalizeUser(
                        item.sender ||
                          item.author
                      );

                    const mine =
                      isSameUser(
                        sender,
                        user
                      );

                    return (
                      <div
                        key={
                          item.id ||
                          item._id
                        }
                        className={`message-row ${
                          mine
                            ? "mine"
                            : ""
                        }`}
                      >
                        {!mine && (
                          <UserAvatar
                            user={sender}
                            size={27}
                          />
                        )}

                        <div className="message-bubble">
                          <p>
                            {item.content ||
                              item.text ||
                              ""}
                          </p>

                          <span>
                            {timeAgo(
                              item.createdAt
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              <div className="message-compose">
                <input
                  value={message}
                  onChange={(e) =>
                    setMessage(
                      e.target.value
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      sendMessage();
                    }
                  }}
                  placeholder="Write a message..."
                />

                <button
                  onClick={sendMessage}
                  disabled={sending}
                  aria-label="Send message"
                >
                  <Send size={17} />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

/* =========================================================
   SEARCH
   ========================================================= */

function SearchView({
  user,
  notify,
}) {
  const [query, setQuery] =
    useState("");

  const [results, setResults] =
    useState({
      users: [],
      posts: [],
      products: [],
    });

  const [loading, setLoading] =
    useState(false);

  const runSearch = useCallback(
    async (value) => {
      const q = value.trim();

      if (!q) {
        setResults({
          users: [],
          posts: [],
          products: [],
        });
        return;
      }

      setLoading(true);

      try {
        const data =
          await api(
            `/search?q=${encodeURIComponent(
              q
            )}`
          );

        setResults({
          users:
            data?.data?.users ||
            data?.users ||
            [],
          posts:
            data?.data?.posts ||
            data?.posts ||
            [],
          products:
            data?.data?.products ||
            data?.products ||
            [],
        });
      } catch {
        notify(
          "Search service unavailable"
        );
      } finally {
        setLoading(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    const timer =
      setTimeout(
        () => runSearch(query),
        350
      );

    return () =>
      clearTimeout(timer);
  }, [query, runSearch]);

  return (
    <section className="content-view">
      <PageHeading
        eyebrow="DISCOVER"
        title="Search"
        description="Find people, posts and products across CareBox."
      />

      <div className="search-field-large">
        <Search size={18} />
        <input
          autoFocus
          value={query}
          onChange={(e) =>
            setQuery(
              e.target.value
            )
          }
          placeholder="Search anything..."
        />
      </div>

      {loading ? (
        <div className="loading-box">
          Searching...
        </div>
      ) : (
        <div className="search-results">
          <SearchSection
            title="People"
            items={results.users}
            render={(item) => (
              <div className="search-person">
                <UserAvatar
                  user={item}
                  size={40}
                />
                <div>
                  <strong>
                    {item.name ||
                      item.username}
                  </strong>
                  <span>
                    @
                    {item.username ||
                      makeUsernameFromEmail(
                        item.email
                      )}
                  </span>
                </div>
              </div>
            )}
          />

          <SearchSection
            title="Posts"
            items={results.posts}
            render={(item) => (
              <div className="search-result">
                <strong>
                  {item.title ||
                    item.description ||
                    "Community post"}
                </strong>
                <span>
                  {item.author?.name ||
                    item.author?.username ||
                    "Community member"}
                </span>
              </div>
            )}
          />

          <SearchSection
            title="Products"
            items={results.products}
            render={(item) => (
              <div className="search-result">
                <strong>
                  {item.name ||
                    item.title}
                </strong>
                <span>
                  KES{" "}
                  {Number(
                    item.price || 0
                  ).toLocaleString()}
                </span>
              </div>
            )}
          />
        </div>
      )}
    </section>
  );
}

function SearchSection({
  title,
  items,
  render,
}) {
  return (
    <section className="search-section">
      <h2>{title}</h2>

      {items.length ? (
        <div>
          {items.map(
            (item, index) => (
              <div
                key={
                  idOf(item) ||
                  index
                }
              >
                {render(item)}
              </div>
            )
          )}
        </div>
      ) : (
        <div className="small-empty">
          No results.
        </div>
      )}
    </section>
  );
}

/* =========================================================
   HOME
   ========================================================= */

function HomeView({
  user,
  go,
}) {
  return (
    <section className="content-view">
      <PageHeading
        eyebrow="CAREBOX"
        title={`Welcome ${
          user?.name ||
          user?.username ||
          ""
        }`}
        description="Your CareBox community, products and conversations in one place."
      />

      <div className="hero-card">
        <UserAvatar
          user={user}
          size={62}
        />
        <div>
          <h2>
            CareBox Community
          </h2>
          <p>
            Connect with people, share resources and discover opportunities.
          </p>
        </div>
      </div>

      <div className="quick-grid">
        <button
          onClick={() => go("community")}
        >
          <Users size={23} />
          <strong>
            Community
          </strong>
          <span>
            Share and connect
          </span>
        </button>

        <button
          onClick={() => go("products")}
        >
          <Package size={23} />
          <strong>
            Products
          </strong>
          <span>
            Buy and sell
          </span>
        </button>

        <button
          onClick={() => go("inbox")}
        >
          <MessageSquare
            size={23}
          />
          <strong>
            Messages
          </strong>
          <span>
            Talk to people
          </span>
        </button>

        <button
          onClick={() => go("profile")}
        >
          <User size={23} />
          <strong>
            Profile
          </strong>
          <span>
            Manage account
          </span>
        </button>
      </div>
    </section>
  );
}

/* =========================================================
   PRODUCTS — KEPT FUNCTIONAL
   ========================================================= */

function ProductsView({
  user,
  notify,
}) {
  const [products, setProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [query, setQuery] =
    useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data =
          await api(
            "/products?limit=30"
          );

        setProducts(
          extractArray(data)
        );
      } catch {
        setProducts(
          readJSON(
            "carebox_products_cache",
            []
          )
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filtered =
    products.filter((product) =>
      `${product.name || ""} ${
        product.description || ""
      }`
        .toLowerCase()
        .includes(
          query.toLowerCase()
        )
    );

  return (
    <section className="content-view">
      <PageHeading
        eyebrow="MARKETPLACE"
        title="Products"
        description="Discover products and opportunities from your community."
      />

      <div className="search-field-large">
        <Search size={17} />
        <input
          value={query}
          onChange={(e) =>
            setQuery(
              e.target.value
            )
          }
          placeholder="Search products..."
        />
      </div>

      {loading ? (
        <div className="loading-box">
          Loading products...
        </div>
      ) : filtered.length ? (
        <div className="product-grid">
          {filtered.map(
            (product) => (
              <article
                className="product-card"
                key={idOf(product)}
              >
                <div className="product-image">
                  {product.image ||
                  product.imageUrl ? (
                    <img
                      src={
                        product.image ||
                        product.imageUrl
                      }
                      alt={
                        product.name ||
                        "Product"
                      }
                    />
                  ) : (
                    <Package
                      size={38}
                    />
                  )}
                </div>

                <div className="product-info">
                  <span>
                    {product.category ||
                      "Other"}
                  </span>

                  <h3>
                    {product.name ||
                      product.title ||
                      "Product"}
                  </h3>

                  <p>
                    {product.description ||
                      "No description provided."}
                  </p>

                  <strong>
                    KES{" "}
                    {Number(
                      product.price ||
                        0
                    ).toLocaleString()}
                  </strong>

                  <button
                    className="secondary-button full"
                    onClick={async () => {
                      const seller =
                        product.seller ||
                        product.owner ||
                        {};

                      try {
                        await api(
                          "/conversations",
                          {
                            method:
                              "POST",
                            body:
                              JSON.stringify(
                                {
                                  participantId:
                                    idOf(
                                      seller
                                    ),
                                  productId:
                                    idOf(
                                      product
                                    ),
                                }
                              ),
                          }
                        );

                        notify(
                          "Conversation started"
                        );
                      } catch {
                        notify(
                          "Could not contact seller"
                        );
                      }
                    }}
                  >
                    <MessageSquare
                      size={16}
                    />
                    Contact seller
                  </button>
                </div>
              </article>
            )
          )}
        </div>
      ) : (
        <EmptyState
          icon={<Package size={30} />}
          title="No products found"
          description="Try another search."
        />
      )}
    </section>
  );
}

/* =========================================================
   NOTIFICATIONS
   ========================================================= */

function NotificationsView({
  notify,
}) {
  const [items, setItems] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data =
          await api(
            "/notifications?limit=30"
          );

        setItems(
          extractArray(data)
        );
      } catch {
        notify(
          "Notifications unavailable"
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [notify]);

  const markRead = async () => {
    setItems((list) =>
      list.map((item) => ({
        ...item,
        read: true,
        isRead: true,
      }))
    );

    try {
      await api(
        "/notifications/read-all",
        { method: "PATCH" }
      );
    } catch {
      // UI already reflects the optimistic state.
    }
  };

  return (
    <section className="content-view">
      <PageHeading
        eyebrow="ACTIVITY"
        title="Notifications"
        description="Stay up to date with activity on your account."
        action={
          <button
            className="secondary-button"
            onClick={markRead}
          >
            Mark all read
          </button>
        }
      />

      {loading ? (
        <div className="loading-box">
          Loading notifications...
        </div>
      ) : items.length ? (
        <div className="notification-list">
          {items.map(
            (item, index) => (
              <div
                className={`notification-row ${
                  item.read ||
                  item.isRead
                    ? ""
                    : "unread-row"
                }`}
                key={
                  idOf(item) ||
                  index
                }
              >
                <div className="notification-icon">
                  <Bell size={17} />
                </div>

                <div>
                  <strong>
                    {item.title ||
                      item.type ||
                      "CareBox activity"}
                  </strong>

                  <p>
                    {item.message ||
                      item.content ||
                      "You have new activity."}
                  </p>

                  <span>
                    {timeAgo(
                      item.createdAt
                    )}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <EmptyState
          icon={<Bell size={29} />}
          title="You're all caught up"
          description="No new notifications."
        />
      )}
    </section>
  );
}

/* =========================================================
   SETTINGS
   ========================================================= */

function SettingsView({
  user,
  setUser,
  notify,
  logout,
}) {
  const [notifications, setNotifications] =
    useState(
      user?.settings?.notifications !==
        false
    );

  const [publicProfile, setPublicProfile] =
    useState(
      user?.settings?.publicProfile !==
        false
    );

  const saveSettings =
    async () => {
      try {
        const data =
          await api(
            "/users/me/settings",
            {
              method: "PATCH",
              body: JSON.stringify({
                notifications,
                publicProfile,
              }),
            }
          );

        const updated =
          normalizeUser(
            data?.data ||
              data?.user
          );

        if (updated) {
          setUser(updated);
        }

        notify(
          "Settings saved"
        );
      } catch {
        notify(
          "Settings could not be saved"
        );
      }
    };

  return (
    <section className="content-view">
      <PageHeading
        eyebrow="ACCOUNT"
        title="Settings"
        description="Manage your CareBox account."
      />

      <div className="settings-card">
        <SettingRow
          title="Notifications"
          description="Receive activity and message notifications."
          checked={notifications}
          onChange={
            setNotifications
          }
        />

        <SettingRow
          title="Public profile"
          description="Allow other community members to discover your profile."
          checked={publicProfile}
          onChange={
            setPublicProfile
          }
        />

        <button
          className="primary-button full"
          onClick={saveSettings}
        >
          <Save size={16} />
          Save settings
        </button>
      </div>

      <div className="danger-zone">
        <h3>Account</h3>
        <p>
          Sign out of this device.
        </p>

        <button
          className="danger-button"
          onClick={logout}
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </section>
  );
}

function SettingRow({
  title,
  description,
  checked,
  onChange,
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>
          {title}
        </strong>
        <span>
          {description}
        </span>
      </div>

      <button
        className={`switch ${
          checked ? "checked" : ""
        }`}
        onClick={() =>
          onChange(!checked)
        }
        aria-label={title}
      >
        <span />
      </button>
    </div>
  );
}

/* =========================================================
   SHARED
   ========================================================= */

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && (
          <span className="eyebrow">
            {eyebrow}
          </span>
        )}

        <h1>{title}</h1>

        {description && (
          <p>{description}</p>
        )}
      </div>

      {action}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        {icon}
      </div>

      <h2>{title}</h2>
      <p>{description}</p>

      {action && (
        <div className="empty-action">
          {action}
        </div>
      )}
    </div>
  );
}

function PostSkeletons() {
  return (
    <div className="feed">
      {[1, 2, 3].map(
        (item) => (
          <div
            className="post skeleton"
            key={item}
          >
            <div className="skeleton-head">
              <div className="skeleton-circle" />
              <div>
                <div className="skeleton-line wide" />
                <div className="skeleton-line small" />
              </div>
            </div>

            <div className="skeleton-line" />
            <div className="skeleton-line medium" />
            <div className="skeleton-media" />
          </div>
        )
      )}
    </div>
  );
}

/* =========================================================
   CANVAS EXPORT
   ========================================================= */

async function renderPostToCanvas(
  element
) {
  /*
    A dependency-free exporter. It clones the rendered post into a
    clean canvas-like drawing. Remote images are attempted first.
    This avoids adding html2canvas to the application bundle.
  */
  const width =
    Math.min(
      Math.max(
        element.getBoundingClientRect()
          .width,
        320
      ),
      1000
    );

  const clone =
    element.cloneNode(true);

  clone
    .querySelectorAll(
      ".post-actions, .comments, .post-menu, .more"
    )
    .forEach((node) =>
      node.remove()
    );

  const text =
    clone.innerText || "";

  const lines =
    wrapCanvasText(
      text,
      65
    );

  const imageNode =
    clone.querySelector(
      ".post-image img"
    );

  let image = null;

  if (imageNode?.src) {
    image =
      await loadImageSafe(
        imageNode.src
      );
  }

  const padding = 28;
  const lineHeight = 26;
  const imageHeight =
    image
      ? Math.min(
          520,
          Math.round(
            (image.height /
              image.width) *
              (width -
                padding * 2)
          )
        )
      : 0;

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    Math.ceil(width * 2);

  canvas.height =
    Math.ceil(
      (padding * 2 +
        lines.length *
          lineHeight +
        (image
          ? imageHeight + 18
          : 0) +
        55) *
        2
    );

  const ctx =
    canvas.getContext("2d");

  ctx.scale(2, 2);

  ctx.fillStyle =
    "#ffffff";

  ctx.fillRect(
    0,
    0,
    width,
    canvas.height / 2
  );

  ctx.fillStyle =
    "#111827";

  ctx.font =
    "600 16px Inter, Arial, sans-serif";

  let y = padding;

  for (const line of lines) {
    ctx.fillText(
      line,
      padding,
      y
    );
    y += lineHeight;
  }

  if (image) {
    y += 10;

    ctx.drawImage(
      image,
      padding,
      y,
      width -
        padding * 2,
      imageHeight
    );

    y += imageHeight + 18;
  }

  ctx.fillStyle =
    "#73777b";

  ctx.font =
    "12px Inter, Arial, sans-serif";

  ctx.fillText(
    "CareBox Community",
    padding,
    y
  );

  return canvas;
}

function wrapCanvasText(
  value,
  maxChars
) {
  const words =
    String(value)
      .replace(/\n+/g, " ")
      .split(/\s+/);

  const lines = [];
  let current = "";

  for (const word of words) {
    if (
      `${current} ${word}`.trim()
        .length > maxChars
    ) {
      if (current) {
        lines.push(current);
      }
      current = word;
    } else {
      current =
        `${current} ${word}`.trim();
    }
  }

  if (current) lines.push(current);

  return lines.slice(0, 60);
}

function loadImageSafe(src) {
  return new Promise(
    (resolve) => {
      const image =
        new Image();

      image.crossOrigin =
        "anonymous";

      image.onload = () =>
        resolve(image);

      image.onerror = () =>
        resolve(null);

      image.src = src;
    }
  );
}

/* =========================================================
   STYLES
   ========================================================= */

const styles = `
:root {
  --blue: #1a73e8;
  --blue-dark: #1769d2;
  --text: #111827;
  --muted: #7b8188;
  --border: #e5e7e9;
  --soft: #f4f6f7;
  --page: #eef1f3;
  --danger: #d93434;
  --green: #38bd62;
  --pink: #f72568;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  min-height: 100%;
  width: 100%;
}

body {
  font-family:
    Inter,
    Roboto,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  background: var(--page);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

button,
input,
textarea,
select {
  font: inherit;
}

button {
  border: 0;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

input,
textarea {
  outline: none;
}

img {
  max-width: 100%;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}

/* APP */

.app-shell {
  min-height: 100vh;
  width: 100%;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 62px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  gap: 24px;
  background: rgba(255,255,255,.97);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(14px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  background: transparent;
  color: var(--text);
  font-weight: 800;
  font-size: 17px;
}

.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--blue);
  color: white;
  font-size: 15px;
}

.desktop-search,
.community-search,
.search-field-large,
.panel-search {
  display: flex;
  align-items: center;
  gap: 8px;
}

.desktop-search {
  width: min(450px, 50vw);
  height: 38px;
  padding: 0 13px;
  border-radius: 20px;
  background: #f3f5f6;
  color: #777;
}

.desktop-search input,
.community-search input,
.search-field-large input,
.panel-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--text);
}

.desktop-search input {
  font-size: 12px;
}

.top-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.top-icon,
.profile-trigger {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: transparent;
  display: grid;
  place-items: center;
  color: #34373a;
}

.top-icon:hover {
  background: #f3f5f6;
}

.mobile-search-button {
  display: none;
}

.profile-dropdown {
  position: fixed;
  z-index: 200;
  right: 18px;
  top: 57px;
  width: 255px;
  padding: 8px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 15px 45px rgba(0,0,0,.15);
}

.dropdown-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid #eee;
  margin-bottom: 5px;
}

.dropdown-user strong,
.dropdown-user span {
  display: block;
}

.dropdown-user strong {
  font-size: 12px;
}

.dropdown-user span {
  margin-top: 3px;
  color: #888;
  font-size: 9px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-dropdown > button {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 10px;
  background: transparent;
  border-radius: 8px;
  text-align: left;
  color: #444;
  font-size: 11px;
}

.profile-dropdown > button:hover {
  background: #f4f5f6;
}

.profile-dropdown .danger {
  color: var(--danger);
}

/* AVATAR */

.avatar {
  object-fit: cover;
  border-radius: 50%;
  display: block;
  flex-shrink: 0;
}

.avatar-letter {
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #e7edf3;
  color: #26313a;
  font-weight: 800;
}

/* PAGE */

.page {
  width: 100%;
  max-width: 920px;
  min-height: calc(100vh - 62px);
  margin: 0 auto;
  padding: 28px 20px 100px;
}

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}

.eyebrow {
  display: block;
  margin-bottom: 6px;
  color: var(--blue);
  font-size: 9px;
  letter-spacing: 1.3px;
  font-weight: 800;
}

.page-heading h1,
.community-mobile-header h1,
.inbox-heading h1 {
  margin: 0;
  font-size: 28px;
  letter-spacing: -.7px;
}

.page-heading p,
.inbox-heading p {
  max-width: 580px;
  margin: 7px 0 0;
  color: #777d82;
  font-size: 12px;
  line-height: 18px;
}

/* COMMUNITY */

.community-page {
  width: min(100%, 650px);
  margin: 0 auto;
}

.community-mobile-header {
  display: none;
}

.composer {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 0 12px;
}

.mind-input {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 15px;
  border: 1px solid #e0e3e5;
  border-radius: 22px;
  background: white;
  color: #777;
  text-align: left;
  font-size: 12px;
}

.mind-input:hover {
  background: #fafafa;
  border-color: #d1d6da;
}

.gallery-button {
  width: 40px;
  height: 40px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: var(--green);
  color: white;
}

.gallery-button:hover {
  filter: brightness(.95);
}

.community-tools {
  margin-bottom: 12px;
}

.community-search {
  height: 39px;
  padding: 0 12px;
  border: 1px solid #dedfe1;
  border-radius: 10px;
  background: white;
  color: #777;
}

.community-search input {
  font-size: 11px;
}

.category-scroll {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 9px 0 3px;
}

.category-scroll::-webkit-scrollbar {
  display: none;
}

.category-pill {
  flex: 0 0 auto;
  height: 31px;
  padding: 0 15px;
  border-radius: 17px;
  background: #f1f3f4;
  color: #5e6367;
  font-size: 10px;
}

.category-pill.active {
  background: var(--blue);
  color: white;
  font-weight: 700;
}

.feed {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.post {
  position: relative;
  background: white;
  border: 1px solid var(--border);
  border-radius: 15px;
  overflow: visible;
}

.post-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 15px 9px;
}

.post-author {
  flex: 1;
  min-width: 0;
}

.post-author strong {
  display: block;
  font-size: 11px;
}

.post-author span {
  display: block;
  margin-top: 3px;
  color: #92969a;
  font-size: 8px;
}

.more {
  width: 31px;
  height: 31px;
  border-radius: 50%;
  background: transparent;
  color: #777;
  display: grid;
  place-items: center;
}

.more:hover {
  background: #f2f3f4;
}

.post-menu {
  position: absolute;
  z-index: 30;
  top: 49px;
  right: 13px;
  width: 180px;
  padding: 5px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 11px;
  box-shadow: 0 12px 30px rgba(0,0,0,.12);
}

.post-menu button {
  width: 100%;
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border-radius: 7px;
  background: transparent;
  color: #444;
  text-align: left;
  font-size: 10px;
}

.post-menu button:hover {
  background: #f5f6f7;
}

.post-menu .danger {
  color: var(--danger);
}

.post-body {
  padding: 0 15px 10px;
}

.post-body h3 {
  margin: 0 0 5px;
  font-size: 13px;
}

.post-body p {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #282b2e;
  font-size: 11px;
  line-height: 18px;
}

.see-more {
  padding: 0;
  background: transparent;
  color: var(--blue);
  font-size: inherit;
  font-weight: 700;
}

.post-image {
  width: calc(100% - 30px);
  margin: 0 15px 10px;
  border-radius: 11px;
  overflow: hidden;
  background: #f0f1f2;
}

.post-image img {
  width: 100%;
  max-height: 520px;
  object-fit: cover;
  display: block;
}

.post-attachment {
  margin: 0 15px 10px;
  min-height: 38px;
  padding: 0 11px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--blue);
  background: #eef5ff;
  border-radius: 9px;
  text-decoration: none;
  font-size: 10px;
  font-weight: 700;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 15px 7px;
}

.tags span {
  color: var(--blue);
  font-size: 9px;
}

.engagement-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 31px;
  padding: 6px 15px;
  color: #85898d;
  font-size: 8px;
}

.engagement-like {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #f72568;
}

.post-actions {
  margin: 0 15px;
  min-height: 41px;
  display: grid;
  grid-template-columns: repeat(3,1fr);
  border-top: 1px solid #eee;
}

.post-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: transparent;
  color: #62676b;
  font-size: 9px;
}

.post-actions button:hover {
  background: #f7f8f8;
}

.post-actions button.liked,
.post-actions button.active {
  color: var(--blue);
  font-weight: 700;
}

.comments {
  margin: 0 15px;
  padding: 10px 0;
  border-top: 1px solid #eee;
}

.comment {
  display: flex;
  gap: 7px;
  margin-bottom: 9px;
}

.comment-bubble {
  padding: 7px 9px;
  border-radius: 10px;
  background: #f2f3f4;
  max-width: min(85%, 470px);
}

.comment-bubble strong {
  font-size: 9px;
}

.comment-bubble p {
  margin: 2px 0;
  font-size: 10px;
  line-height: 14px;
}

.comment-bubble span {
  color: #999;
  font-size: 7px;
}

.comment-compose {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.comment-compose input,
.message-compose input {
  flex: 1;
  min-width: 0;
  height: 35px;
  padding: 0 11px;
  border: 1px solid #ddd;
  border-radius: 18px;
  font-size: 9px;
  background: white;
}

.comment-compose input:focus,
.message-compose input:focus {
  border-color: var(--blue);
}

.comment-compose button,
.message-compose button {
  width: 35px;
  height: 35px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--blue);
  color: white;
}

.no-comments {
  padding: 10px;
  text-align: center;
  color: #999;
  font-size: 9px;
}

.feed-end {
  min-height: 45px;
  display: grid;
  place-items: center;
  color: #999;
  font-size: 9px;
}

/* BUTTONS */

.primary-button,
.secondary-button,
.danger-button {
  min-height: 38px;
  padding: 0 15px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 10px;
  font-weight: 700;
}

.primary-button {
  background: var(--blue);
  color: white;
}

.primary-button:hover {
  background: var(--blue-dark);
}

.secondary-button {
  background: #f1f3f4;
  color: #444;
}

.danger-button {
  background: #fff0f0;
  color: var(--danger);
}

.primary-button.full,
.secondary-button.full {
  width: 100%;
}

/* PROFILE */

.profile-cover {
  height: 145px;
  border-radius: 18px 18px 0 0;
  background:
    linear-gradient(
      120deg,
      #dceaff,
      #f7faff 50%,
      #e9f2ff
    );
}

.profile-card {
  position: relative;
  background: white;
  border: 1px solid var(--border);
  border-top: 0;
  border-radius: 0 0 18px 18px;
  padding: 0 25px 25px;
}

.profile-avatar-wrap {
  position: relative;
  width: 88px;
  height: 88px;
  margin-top: -44px;
}

.profile-avatar-large {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid white;
  display: grid;
  place-items: center;
}

.profile-avatar-letter {
  background: #e7edf3;
  color: #27313b;
  font-size: 34px;
  font-weight: 800;
}

.avatar-edit {
  position: absolute;
  right: 0;
  bottom: 3px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--blue);
  color: white;
  border: 2px solid white;
}

.profile-heading-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 15px;
  margin-top: 10px;
}

.profile-heading-row h1 {
  margin: 0;
  font-size: 23px;
}

.profile-heading-row span {
  display: block;
  margin-top: 4px;
  color: #85898d;
  font-size: 10px;
}

.profile-info {
  margin-top: 17px;
}

.profile-info p {
  margin: 0 0 7px;
  color: #444;
  font-size: 11px;
  line-height: 18px;
}

.profile-info span {
  color: #888;
  font-size: 9px;
}

.profile-form {
  margin-top: 17px;
  display: grid;
  gap: 12px;
}

.profile-form label {
  display: grid;
  gap: 6px;
  color: #666;
  font-size: 9px;
  font-weight: 700;
}

.form-input {
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid #ddd;
  border-radius: 10px;
  background: white;
  color: var(--text);
  font-size: 11px;
}

.form-input:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(26,115,232,.08);
}

.textarea {
  min-height: 90px;
  padding-top: 11px;
  resize: vertical;
}

.profile-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.profile-stats {
  margin-top: 22px;
  padding-top: 17px;
  border-top: 1px solid #eee;
  display: grid;
  grid-template-columns: repeat(3,1fr);
  text-align: center;
}

.profile-stats strong,
.profile-stats span {
  display: block;
}

.profile-stats strong {
  font-size: 17px;
}

.profile-stats span {
  margin-top: 3px;
  color: #888;
  font-size: 8px;
}

/* INBOX */

.inbox-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 22px;
}

.inbox-layout {
  display: grid;
  grid-template-columns: 310px 1fr;
  min-height: 590px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 15px;
  overflow: hidden;
}

.conversation-panel {
  border-right: 1px solid #eee;
  overflow-y: auto;
}

.panel-title {
  min-height: 49px;
  padding: 0 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #eee;
  font-size: 10px;
}

.panel-search {
  margin: 10px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #ddd;
  border-radius: 18px;
  color: #777;
}

.panel-search input {
  font-size: 9px;
}

.conversation,
.person-row {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px;
  border-bottom: 1px solid #f0f0f0;
  background: white;
  text-align: left;
}

.conversation:hover,
.conversation.active,
.person-row:hover {
  background: #f4f8fd;
}

.conversation > div,
.person-row > div {
  min-width: 0;
  flex: 1;
}

.conversation strong,
.person-row strong {
  display: block;
  font-size: 10px;
}

.conversation p {
  margin: 3px 0;
  color: #777;
  font-size: 9px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conversation span,
.person-row span {
  color: #aaa;
  font-size: 7px;
}

.unread {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--blue);
  color: white;
  font-size: 7px;
}

.chat-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fbfcfd;
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 30px;
  text-align: center;
  color: #8b9095;
}

.chat-empty h3 {
  margin: 6px 0 0;
  color: #333;
  font-size: 15px;
}

.chat-empty p {
  max-width: 260px;
  margin: 0 0 8px;
  font-size: 10px;
  line-height: 16px;
}

.chat-header {
  min-height: 63px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 13px;
  background: white;
  border-bottom: 1px solid #eee;
}

.chat-header > div:last-child {
  min-width: 0;
}

.chat-header strong,
.chat-header span {
  display: block;
}

.chat-header strong {
  font-size: 11px;
}

.chat-header span {
  margin-top: 3px;
  color: #999;
  font-size: 8px;
}

.chat-back {
  display: none;
  width: 31px;
  height: 31px;
  place-items: center;
  background: transparent;
  border-radius: 50%;
}

.messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  max-width: 82%;
}

.message-row.mine {
  align-self: flex-end;
}

.message-bubble {
  padding: 8px 10px;
  border-radius: 13px 13px 13px 4px;
  background: #edf0f2;
}

.message-row.mine .message-bubble {
  border-radius: 13px 13px 4px 13px;
  background: var(--blue);
  color: white;
}

.message-bubble p {
  margin: 0;
  font-size: 10px;
  line-height: 15px;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-bubble span {
  display: block;
  margin-top: 3px;
  opacity: .7;
  font-size: 7px;
}

.message-compose {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px;
  background: white;
  border-top: 1px solid #eee;
}

.empty-conversations {
  min-height: 300px;
  padding: 30px 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  color: #999;
}

.empty-conversations strong {
  color: #444;
  font-size: 12px;
}

.empty-conversations span {
  max-width: 220px;
  font-size: 9px;
  line-height: 15px;
}

/* SEARCH */

.search-field-large {
  height: 48px;
  margin-bottom: 20px;
  padding: 0 14px;
  border: 1px solid #dedfe1;
  border-radius: 13px;
  background: white;
  color: #777;
}

.search-field-large input {
  font-size: 11px;
}

.search-results {
  display: grid;
  gap: 18px;
}

.search-section {
  background: white;
  border: 1px solid var(--border);
  border-radius: 13px;
  overflow: hidden;
}

.search-section h2 {
  margin: 0;
  padding: 13px 14px;
  border-bottom: 1px solid #eee;
  font-size: 12px;
}

.search-person,
.search-result {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 14px;
  border-bottom: 1px solid #f1f1f1;
}

.search-person:last-child,
.search-result:last-child {
  border-bottom: 0;
}

.search-person > div,
.search-result {
  min-width: 0;
}

.search-person strong,
.search-person span,
.search-result strong,
.search-result span {
  display: block;
}

.search-person strong,
.search-result strong {
  font-size: 10px;
}

.search-person span,
.search-result span {
  margin-top: 3px;
  color: #888;
  font-size: 8px;
}

.small-empty {
  padding: 15px;
  color: #999;
  font-size: 9px;
}

/* HOME */

.hero-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 24px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 17px;
  margin-bottom: 14px;
}

.hero-card h2 {
  margin: 0;
  font-size: 20px;
}

.hero-card p {
  max-width: 520px;
  margin: 6px 0 0;
  color: #777;
  font-size: 11px;
  line-height: 17px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 10px;
}

.quick-grid button {
  min-height: 125px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 6px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 15px;
  text-align: left;
  color: var(--blue);
}

.quick-grid strong {
  color: #222;
  font-size: 11px;
}

.quick-grid span {
  color: #888;
  font-size: 8px;
}

/* PRODUCTS */

.product-grid {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 12px;
}

.product-card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 15px;
  overflow: hidden;
}

.product-image {
  aspect-ratio: 1.15;
  display: grid;
  place-items: center;
  background: #f1f3f4;
  color: #9ba0a4;
  overflow: hidden;
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-info {
  padding: 12px;
}

.product-info > span {
  color: var(--blue);
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
}

.product-info h3 {
  margin: 4px 0;
  font-size: 12px;
}

.product-info p {
  height: 34px;
  overflow: hidden;
  margin: 0 0 8px;
  color: #777;
  font-size: 9px;
  line-height: 15px;
}

.product-info > strong {
  display: block;
  margin-bottom: 10px;
  font-size: 14px;
}

/* SETTINGS */

.settings-card,
.danger-zone,
.notification-list {
  background: white;
  border: 1px solid var(--border);
  border-radius: 15px;
}

.settings-card {
  padding: 7px 15px 15px;
}

.setting-row {
  min-height: 65px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid #eee;
}

.setting-row strong,
.setting-row span {
  display: block;
}

.setting-row strong {
  font-size: 11px;
}

.setting-row span {
  margin-top: 4px;
  color: #888;
  font-size: 8px;
}

.switch {
  width: 39px;
  height: 23px;
  padding: 3px;
  border-radius: 13px;
  background: #d5d9dc;
}

.switch span {
  width: 17px;
  height: 17px;
  margin: 0;
  border-radius: 50%;
  background: white;
  transition: transform .18s ease;
}

.switch.checked {
  background: var(--blue);
}

.switch.checked span {
  transform: translateX(16px);
}

.danger-zone {
  margin-top: 15px;
  padding: 18px;
}

.danger-zone h3 {
  margin: 0;
  font-size: 13px;
}

.danger-zone p {
  color: #888;
  font-size: 9px;
}

/* NOTIFICATIONS */

.notification-row {
  display: flex;
  gap: 10px;
  padding: 14px;
  border-bottom: 1px solid #eee;
}

.notification-row:last-child {
  border-bottom: 0;
}

.notification-icon {
  width: 35px;
  height: 35px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #edf4ff;
  color: var(--blue);
}

.notification-row strong {
  font-size: 10px;
}

.notification-row p {
  margin: 4px 0;
  color: #555;
  font-size: 9px;
  line-height: 14px;
}

.notification-row span {
  color: #999;
  font-size: 7px;
}

.unread-row {
  background: #f7fbff;
}

/* MODAL */

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 500;
  padding: 15px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(10,15,20,.45);
  backdrop-filter: blur(3px);
}

.modal {
  width: 100%;
  max-width: 570px;
  max-height: 92vh;
  overflow-y: auto;
  background: white;
  border-radius: 20px 20px 12px 12px;
  box-shadow: 0 -8px 30px rgba(0,0,0,.2);
  animation: modal-up .2s ease-out;
}

@keyframes modal-up {
  from {
    transform: translateY(25px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  font-size: 17px;
}

.modal-header p {
  margin: 4px 0 0;
  color: #888;
  font-size: 9px;
}

.modal-close {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #f1f2f3;
  color: #333;
}

.modal-form {
  padding: 14px;
  display: grid;
  gap: 10px;
}

.image-picker {
  min-height: 145px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 2px dashed #d8dce0;
  border-radius: 12px;
  background: #fafbfc;
  color: #888;
  cursor: pointer;
  overflow: hidden;
}

.image-picker strong {
  color: #444;
  font-size: 11px;
}

.image-picker span {
  font-size: 9px;
}

.image-picker img {
  width: 100%;
  max-height: 270px;
  object-fit: contain;
}

.form-error {
  margin: 12px 14px 0;
  padding: 10px 11px;
  border-radius: 9px;
  background: #fff0f0;
  color: var(--danger);
  font-size: 9px;
  line-height: 14px;
}

.modal-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 2px;
}

.modal-user strong,
.modal-user span {
  display: block;
}

.modal-user strong {
  font-size: 10px;
}

.modal-user span {
  margin-top: 2px;
  color: #999;
  font-size: 8px;
}

/* EMPTY / LOADING */

.empty-state {
  min-height: 300px;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #888;
}

.empty-icon {
  width: 57px;
  height: 57px;
  margin-bottom: 12px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #edf4ff;
  color: var(--blue);
}

.empty-state h2 {
  margin: 0 0 6px;
  color: #222;
  font-size: 16px;
}

.empty-state p {
  max-width: 300px;
  margin: 0;
  font-size: 10px;
  line-height: 16px;
}

.empty-action {
  margin-top: 14px;
}

.loading-box {
  min-height: 100px;
  display: grid;
  place-items: center;
  color: #888;
  font-size: 10px;
}

.skeleton {
  padding: 15px;
  overflow: hidden;
}

.skeleton-head {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.skeleton-circle,
.skeleton-line,
.skeleton-media {
  background:
    linear-gradient(
      90deg,
      #eeeeee,
      #f7f7f7,
      #eeeeee
    );
  background-size: 200% 100%;
  animation: skeleton 1.3s infinite;
  border-radius: 7px;
}

.skeleton-circle {
  width: 42px;
  height: 42px;
  border-radius: 50%;
}

.skeleton-line {
  width: 82%;
  height: 10px;
  margin-bottom: 9px;
}

.skeleton-line.wide {
  width: 150px;
}

.skeleton-line.small {
  width: 75px;
}

.skeleton-line.medium {
  width: 52%;
}

.skeleton-media {
  width: 100%;
  height: 260px;
  margin-top: 16px;
}

@keyframes skeleton {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* BOTTOM NAV */

.bottom-nav {
  position: fixed;
  z-index: 300;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 100%;
  max-width: 920px;
  height: 62px;
  display: grid;
  grid-template-columns: repeat(4,1fr);
  background: rgba(255,255,255,.98);
  border-top: 1px solid var(--border);
  box-shadow: 0 -4px 16px rgba(0,0,0,.04);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: transparent;
  color: #555;
  font-size: 9px;
}

.nav-item.active {
  color: var(--blue);
  font-weight: 700;
}

.nav-item:active {
  transform: scale(.94);
}

.fab {
  position: fixed;
  z-index: 350;
  left: 50%;
  bottom: 35px;
  transform: translateX(-50%);
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--blue);
  color: white;
  box-shadow: 0 4px 16px rgba(26,115,232,.35);
}

.fab:hover {
  transform: translateX(-50%) scale(1.05);
}

/* TOAST */

.toast {
  position: fixed;
  z-index: 700;
  left: 50%;
  bottom: 80px;
  transform: translateX(-50%);
  max-width: min(90vw, 420px);
  min-height: 38px;
  padding: 9px 13px;
  display: flex;
  align-items: center;
  gap: 7px;
  border-radius: 20px;
  background: #1e2328;
  color: white;
  box-shadow: 0 8px 25px rgba(0,0,0,.2);
  font-size: 9px;
}

/* TABLET */

@media (min-width: 601px) {
  .bottom-nav {
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
  }

  .fab {
    bottom: 36px;
  }
}

/* MOBILE */

@media (max-width: 700px) {
  body {
    background: white;
  }

  .topbar {
    height: 56px;
    padding: 0 13px;
  }

  .desktop-search {
    display: none;
  }

  .mobile-search-button {
    display: grid;
  }

  .page {
    min-height: calc(100vh - 56px);
    padding: 14px 13px 90px;
  }

  .community-mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 0 9px;
  }

  .community-mobile-header h1 {
    font-size: 18px;
    letter-spacing: -.35px;
  }

  .mobile-refresh {
    width: 35px;
    height: 35px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #f2f4f5;
    color: #555;
  }

  .page-heading {
    margin-bottom: 17px;
  }

  .page-heading h1,
  .inbox-heading h1 {
    font-size: 22px;
  }

  .page-heading p,
  .inbox-heading p {
    font-size: 10px;
  }

  .inbox-heading {
    align-items: flex-start;
  }

  .inbox-heading .secondary-button {
    min-width: 115px;
  }

  .community-page {
    width: 100%;
  }

  .composer {
    padding-top: 3px;
  }

  .post {
    border-left: 0;
    border-right: 0;
    border-radius: 0;
    margin-left: -13px;
    margin-right: -13px;
  }

  .feed {
    gap: 7px;
  }

  .post-image {
    border-radius: 8px;
  }

  .inbox-layout {
    grid-template-columns: 1fr;
    min-height: 570px;
  }

  .conversation-panel {
    border-right: 0;
    border-bottom: 1px solid #eee;
    max-height: 350px;
  }

  .chat-panel {
    min-height: 420px;
  }

  .chat-back {
    display: grid;
  }

  .product-grid {
    grid-template-columns: repeat(2,1fr);
  }

  .quick-grid {
    grid-template-columns: repeat(2,1fr);
  }

  .profile-card {
    padding: 0 17px 20px;
  }

  .profile-heading-row {
    align-items: flex-start;
  }
}

/* SMALL PHONES */

@media (max-width: 390px) {
  .brand {
    font-size: 15px;
  }

  .top-actions {
    gap: 0;
  }

  .composer {
    gap: 7px;
  }

  .mind-input {
    height: 38px;
    font-size: 11px;
  }

  .gallery-button {
    width: 38px;
    height: 38px;
  }

  .category-pill {
    padding: 0 13px;
    font-size: 9px;
  }

  .post-head {
    padding-left: 12px;
    padding-right: 12px;
  }

  .post-body {
    padding-left: 12px;
    padding-right: 12px;
  }

  .post-image {
    width: calc(100% - 24px);
    margin-left: 12px;
    margin-right: 12px;
  }

  .tags,
  .engagement-row {
    padding-left: 12px;
    padding-right: 12px;
  }

  .post-actions {
    margin-left: 12px;
    margin-right: 12px;
  }

  .post-actions button {
    font-size: 8px;
  }

  .product-grid {
    grid-template-columns: 1fr;
  }

  .quick-grid {
    grid-template-columns: 1fr 1fr;
  }

  .quick-grid button {
    min-height: 105px;
    padding: 13px;
  }

  .modal-backdrop {
    padding: 8px;
  }

  .modal {
    border-radius: 17px 17px 10px 10px;
  }
}
`;

