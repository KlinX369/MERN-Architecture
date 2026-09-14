import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

/*
=========================================================
CAREBOX COMMUNITY — SINGLE FILE APP
=========================================================

Frontend responsibilities:
- UI
- authentication token
- API communication
- optimistic updates
- local cache/offline fallback
- navigation
- profile
- home
- products
- community
- inbox
- notifications
- search

Backend responsibilities:
- authentication
- MongoDB persistence
- authorization
- image storage
- cross-user synchronization
- messages
- notifications
- likes/comments
*/

/* ======================================================
CONFIG
====================================================== */

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api";

const STORAGE = {
  USER: "carebox_user",
  TOKEN: "token",
  POSTS: "carebox_posts_cache",
  PRODUCTS: "carebox_products_cache",
  SAVED: "carebox_saved_posts",
  SEARCHES: "carebox_recent_searches",
};

/* ======================================================
ICON SYSTEM
====================================================== */

const Icon = ({
  name,
  size = 21,
  strokeWidth = 1.8,
  filled = false,
}) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: filled ? "currentColor" : "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: "block",
      flexShrink: 0,
    },
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v11h14V9" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );

    case "box":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 8 9 5 9-5" />
          <path d="M3 8v9l9 5 9-5V8" />
        </svg>
      );

    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20a6 6 0 0 1 12 0" />
          <path d="M16 5a3 3 0 0 1 0 6" />
          <path d="M18 14a5 5 0 0 1 3 4.5" />
        </svg>
      );

    case "inbox":
      return (
        <svg {...common}>
          <path d="M4 5h16v14H4z" />
          <path d="M4 13h4l2 2h4l2-2h4" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );

    case "bell":
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
      );

    case "heart":
      return (
        <svg {...common}>
          <path d="M20.8 8.8c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" />
        </svg>
      );

    case "comment":
      return (
        <svg {...common}>
          <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 9.8 9.8 0 0 1-3.5-.6L4 20l1.6-3.5A7.1 7.1 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />
        </svg>
      );

    case "send":
      return (
        <svg {...common}>
          <path d="m21 3-7.5 18-3.5-7-7-3.5L21 3Z" />
          <path d="M21 3 10 14" />
        </svg>
      );

    case "share":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="m7 8 5-5 5 5" />
          <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
        </svg>
      );

    case "save":
      return (
        <svg {...common}>
          <path d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v18l-7-4-7 4V4Z" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );

    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "more":
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1.2" fill="currentColor" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
          <circle cx="19" cy="12" r="1.2" fill="currentColor" />
        </svg>
      );

    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );

    case "image":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      );

    case "edit":
      return (
        <svg {...common}>
          <path d="m4 20 4-.8L19 8.2a2 2 0 0 0-3-3L5 16l-1 4Z" />
          <path d="m14.5 6.5 3 3" />
        </svg>
      );

    case "logout":
      return (
        <svg {...common}>
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M21 3v18" />
        </svg>
      );

    case "checkCircle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" />
        </svg>
      );

    case "message":
      return (
        <svg {...common}>
          <path d="M4 5h16v12H8l-4 4V5Z" />
        </svg>
      );

    case "cart":
      return (
        <svg {...common}>
          <path d="M3 4h2l2 11h11l2-8H6" />
          <circle cx="9" cy="19" r="1.5" />
          <circle cx="17" cy="19" r="1.5" />
        </svg>
      );

    case "location":
      return (
        <svg {...common}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );

    case "filter":
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M7 12h10" />
          <path d="M10 18h4" />
        </svg>
      );

    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 14h10l1-14" />
          <path d="M9 7V4h6v3" />
        </svg>
      );

    default:
      return null;
  }
};

/* ======================================================
HELPERS
====================================================== */

const token = () => {
  try {
    return localStorage.getItem(STORAGE.TOKEN) || "";
  } catch {
    return "";
  }
};

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const getStoredUser = () => {
  return read(STORAGE.USER, null);
};

const normalizeUser = (user) => {
  if (!user) return null;

  return {
    ...user,
    name:
      user.name ||
      user.username ||
      user.email?.split("@")[0] ||
      "User",
    username:
      user.username ||
      user.name ||
      user.email?.split("@")[0] ||
      "user",
    email: user.email || "",
    avatar:
      user.avatar ||
      user.profilePicture ||
      user.photoURL ||
      "",
  };
};

const initials = (user) => {
  const value =
    user?.name ||
    user?.username ||
    user?.email ||
    "U";

  const parts = String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return (
      parts[0][0] +
      parts[1][0]
    ).toUpperCase();
  }

  return value
    .charAt(0)
    .toUpperCase();
};

const timeAgo = (date) => {
  if (!date) return "Just now";

  const time = new Date(date).getTime();

  if (Number.isNaN(time)) return "Just now";

  const diff = Math.max(
    0,
    Date.now() - time
  );

  const seconds = Math.floor(
    diff / 1000
  );

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(
    seconds / 60
  );

  if (minutes < 60)
    return `${minutes}m ago`;

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24)
    return `${hours}h ago`;

  const days = Math.floor(
    hours / 24
  );

  if (days < 7)
    return `${days}d ago`;

  const weeks = Math.floor(
    days / 7
  );

  if (weeks < 5)
    return `${weeks}w ago`;

  return `${Math.floor(
    days / 30
  )}mo ago`;
};

const avatar = (user) => {
  if (user?.avatar) return user.avatar;

  return "";
};

const normalizePost = (post) => ({
  ...post,
  id:
    post?.id ||
    post?._id ||
    `local-${Date.now()}`,
  title: post?.title || "",
  description:
    post?.description ||
    post?.content ||
    "",
  image:
    post?.imageUrls?.optimized ||
    post?.imageUrls?.fullsize ||
    post?.image ||
    post?.imageUrl ||
    "",
  tags: Array.isArray(post?.tags)
    ? post.tags
    : [],
  likeCount: Number(
    post?.likeCount || 0
  ),
  commentCount: Number(
    post?.commentCount || 0
  ),
  createdAt:
    post?.createdAt ||
    new Date().toISOString(),
  author:
    post?.artist ||
    post?.author ||
    {
      username:
        "Community Member",
    },
});

const normalizeProduct = (
  product
) => ({
  ...product,
  id:
    product?.id ||
    product?._id ||
    `local-product-${Date.now()}`,
  name:
    product?.name ||
    product?.title ||
    "Product",
  description:
    product?.description || "",
  price: Number(
    product?.price || 0
  ),
  image:
    product?.image ||
    product?.imageUrl ||
    product?.imageUrls?.optimized ||
    "",
  category:
    product?.category ||
    "Other",
  seller:
    product?.seller ||
    product?.owner ||
    {},
  createdAt:
    product?.createdAt ||
    new Date().toISOString(),
});

/* ======================================================
API
====================================================== */

const api = async (
  endpoint,
  options = {}
) => {
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : {
          "Content-Type":
            "application/json",
        }),
    ...(token()
      ? {
          Authorization:
            `Bearer ${token()}`,
        }
      : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(
    `${API_BASE}${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {}

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Request failed (${response.status})`
    );
  }

  return data;
};

/* ======================================================
AVATAR COMPONENT
====================================================== */

function UserAvatar({
  user,
  size = 40,
  className = "",
}) {
  if (avatar(user)) {
    return (
      <img
        src={avatar(user)}
        alt=""
        className={`avatar ${className}`}
        style={{
          width: size,
          height: size,
        }}
      />
    );
  }

  return (
    <div
      className={`avatar avatar-initials ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(
          11,
          size * 0.38
        ),
      }}
    >
      {initials(user)}
    </div>
  );
}

/* ======================================================
MAIN APPLICATION
====================================================== */

export default function CareBoxCommunity() {
  const navigate = useNavigate();

  const [user, setUser] =
    useState(() =>
      normalizeUser(
        getStoredUser()
      )
    );

  const [activeView, setActiveView] =
    useState("home");

  const [showCreatePost, setShowCreatePost] =
    useState(false);

  const [showCreateProduct, setShowCreateProduct] =
    useState(false);

  const [showProfile, setShowProfile] =
    useState(false);

  const [globalSearch, setGlobalSearch] =
    useState("");

  const [notifications, setNotifications] =
    useState([]);

  const [unreadNotifications, setUnreadNotifications] =
    useState(0);

  const [refreshing, setRefreshing] =
    useState(false);

  const [toast, setToast] =
    useState("");

  /* ====================================================
     TOAST
  ==================================================== */

  const notify = useCallback(
    (message) => {
      setToast(message);

      window.clearTimeout(
        window.__careboxToast
      );

      window.__careboxToast =
        window.setTimeout(() => {
          setToast("");
        }, 2800);
    },
    []
  );

  /* ====================================================
     LOAD USER
  ==================================================== */

  useEffect(() => {
    const stored =
      normalizeUser(
        getStoredUser()
      );

    if (stored) {
      setUser(stored);
    }
  }, []);

  /* ====================================================
     GLOBAL SEARCH
  ==================================================== */

  const handleGlobalSearch = (
    event
  ) => {
    if (event.key === "Enter") {
      const query =
        globalSearch.trim();

      if (!query) return;

      const searches =
        read(
          STORAGE.SEARCHES,
          []
        );

      write(
        STORAGE.SEARCHES,
        [
          query,
          ...searches.filter(
            (item) =>
              item !== query
          ),
        ].slice(0, 10)
      );

      setActiveView("search");
    }
  };

  /* ====================================================
     NOTIFICATIONS
  ==================================================== */

  const loadNotifications =
    useCallback(async () => {
      if (!token()) return;

      try {
        const data =
          await api(
            "/notifications?limit=30"
          );

        const list =
          Array.isArray(
            data?.data
          )
            ? data.data
            : Array.isArray(data)
            ? data
            : [];

        setNotifications(list);

        setUnreadNotifications(
          list.filter(
            (item) =>
              !item.read &&
              !item.isRead
          ).length
        );
      } catch (error) {
        console.warn(
          "Notifications unavailable",
          error
        );
      }
    }, []);

  useEffect(() => {
    loadNotifications();

    const timer =
      setInterval(
        loadNotifications,
        30000
      );

    return () =>
      clearInterval(timer);
  }, [
    loadNotifications,
  ]);

  const markAllNotificationsRead =
    async () => {
      setNotifications(
        (items) =>
          items.map((item) => ({
            ...item,
            read: true,
            isRead: true,
          }))
      );

      setUnreadNotifications(0);

      try {
        await api(
          "/notifications/read-all",
          {
            method: "PATCH",
          }
        );
      } catch {}
    };

  /* ====================================================
     REFRESH
  ==================================================== */

  const refreshEverything =
    async () => {
      setRefreshing(true);

      try {
        await loadNotifications();

        window.dispatchEvent(
          new Event(
            "carebox-refresh"
          )
        );

        notify(
          "Community refreshed"
        );
      } finally {
        setRefreshing(false);
      }
    };

  /* ====================================================
     LOGOUT
  ==================================================== */

  const logout = () => {
    localStorage.removeItem(
      STORAGE.TOKEN
    );
    localStorage.removeItem(
      STORAGE.USER
    );

    setUser(null);

    navigate("/login");
  };

  /* ====================================================
     NAVIGATION
  ==================================================== */

  const go = (view) => {
    setActiveView(view);
    setShowProfile(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <>
      <style>{styles}</style>

      <div className="app-shell">
        <header className="topbar">
          <button
            className="brand"
            onClick={() =>
              go("home")
            }
          >
            <span className="brand-mark">
              C
            </span>
            <span>
              CareBox
            </span>
          </button>

          <div className="top-search">
            <Icon
              name="search"
              size={17}
            />

            <input
              value={globalSearch}
              onChange={(e) =>
                setGlobalSearch(
                  e.target.value
                )
              }
              onKeyDown={
                handleGlobalSearch
              }
              placeholder="Search CareBox..."
            />
          </div>

          <div className="top-actions">
            <button
              className="top-icon"
              onClick={() =>
                go("search")
              }
            >
              <Icon
                name="search"
                size={20}
              />
            </button>

            <button
              className="top-icon notification-icon"
              onClick={() =>
                go("notifications")
              }
            >
              <Icon
                name="bell"
                size={20}
              />

              {unreadNotifications >
                0 && (
                <span className="notification-count">
                  {unreadNotifications >
                  9
                    ? "9+"
                    : unreadNotifications}
                </span>
              )}
            </button>

            <button
              className="profile-trigger"
              onClick={() =>
                setShowProfile(
                  (value) => !value
                )
              }
            >
              <UserAvatar
                user={user}
                size={34}
              />
            </button>
          </div>
        </header>

        {showProfile && (
          <div className="profile-dropdown">
            <div className="dropdown-user">
              <UserAvatar
                user={user}
                size={44}
              />

              <div>
                <strong>
                  {user?.name ||
                    user?.username ||
                    "User"}
                </strong>

                <span>
                  {user?.email ||
                    "Community member"}
                </span>
              </div>
            </div>

            <button
              onClick={() =>
                go("profile")
              }
            >
              <Icon
                name="user"
                size={17}
              />
              Profile
            </button>

            <button
              onClick={() =>
                go("settings")
              }
            >
              <Icon
                name="edit"
                size={17}
              />
              Account settings
            </button>

            <button
              className="danger"
              onClick={logout}
            >
              <Icon
                name="logout"
                size={17}
              />
              Log out
            </button>
          </div>
        )}

        <main className="page">
          {activeView === "home" && (
            <HomeView
              user={user}
              go={go}
              onCreatePost={() =>
                setShowCreatePost(
                  true
                )
              }
              onCreateProduct={() =>
                setShowCreateProduct(
                  true
                )
              }
              notify={notify}
            />
          )}

          {activeView ===
            "products" && (
            <ProductsView
              user={user}
              notify={notify}
              onCreate={() =>
                setShowCreateProduct(
                  true
                )
              }
            />
          )}

          {activeView ===
            "community" && (
            <CommunityView
              user={user}
              notify={notify}
              onCreate={() =>
                setShowCreatePost(
                  true
                )
              }
            />
          )}

          {activeView === "inbox" && (
            <InboxView
              user={user}
              notify={notify}
            />
          )}

          {activeView ===
            "notifications" && (
            <NotificationsView
              notifications={
                notifications
              }
              unread={
                unreadNotifications
              }
              onRead={
                markAllNotificationsRead
              }
            />
          )}

          {activeView ===
            "search" && (
            <SearchView
              query={globalSearch}
              setQuery={
                setGlobalSearch
              }
              go={go}
              notify={notify}
            />
          )}

          {activeView ===
            "profile" && (
            <ProfileView
              user={user}
              setUser={setUser}
              notify={notify}
            />
          )}

          {activeView ===
            "settings" && (
            <SettingsView
              user={user}
              setUser={setUser}
              logout={logout}
              notify={notify}
            />
          )}
        </main>

        <nav className="bottom-nav">
          <NavButton
            active={
              activeView === "home"
            }
            icon="home"
            label="Home"
            onClick={() =>
              go("home")
            }
          />

          <NavButton
            active={
              activeView ===
              "products"
            }
            icon="box"
            label="Products"
            onClick={() =>
              go("products")
            }
          />

          <NavButton
            active={
              activeView ===
              "community"
            }
            icon="users"
            label="Community"
            onClick={() =>
              go("community")
            }
          />

          <NavButton
            active={
              activeView === "inbox"
            }
            icon="inbox"
            label="Inbox"
            onClick={() =>
              go("inbox")
            }
          />
        </nav>

        <button
          className="floating-button"
          onClick={() =>
            setShowCreatePost(true)
          }
          aria-label="Create"
        >
          <Icon
            name="plus"
            size={26}
            strokeWidth={2}
          />
        </button>

        {showCreatePost && (
          <CreatePostModal
            user={user}
            onClose={() =>
              setShowCreatePost(
                false
              )
            }
            onCreated={() => {
              window.dispatchEvent(
                new Event(
                  "carebox-refresh"
                )
              );

              notify(
                "Post published successfully"
              );
            }}
          />
        )}

        {showCreateProduct && (
          <CreateProductModal
            user={user}
            onClose={() =>
              setShowCreateProduct(
                false
              )
            }
            onCreated={() => {
              window.dispatchEvent(
                new Event(
                  "carebox-refresh"
                )
              );

              notify(
                "Product published successfully"
              );
            }}
          />
        )}

        {refreshing && (
          <div className="refresh-indicator">
            Refreshing...
          </div>
        )}

        {toast && (
          <div className="toast">
            <Icon
              name="checkCircle"
              size={17}
            />
            {toast}
          </div>
        )}
      </div>
    </>
  );
}

/* ======================================================
NAV BUTTON
====================================================== */

function NavButton({
  active,
  icon,
  label,
  onClick,
}) {
  return (
    <button
      className={`nav-button ${
        active ? "active" : ""
      }`}
      onClick={onClick}
    >
      <Icon
        name={icon}
        size={21}
      />

      <span>{label}</span>
    </button>
  );
}

/* ======================================================
HOME
====================================================== */

function HomeView({
  user,
  go,
  onCreatePost,
  onCreateProduct,
  notify,
}) {
  const [stats, setStats] =
    useState({
      posts: 0,
      products: 0,
      messages: 0,
    });

  const load = useCallback(
    async () => {
      try {
        const data =
          await api(
            "/dashboard/summary"
          );

        setStats({
          posts:
            data?.data?.posts ||
            0,
          products:
            data?.data?.products ||
            0,
          messages:
            data?.data?.messages ||
            0,
        });
      } catch {}
    },
    []
  );

  useEffect(() => {
    load();

    const handler = () =>
      load();

    window.addEventListener(
      "carebox-refresh",
      handler
    );

    return () =>
      window.removeEventListener(
        "carebox-refresh",
        handler
      );
  }, [load]);

  return (
    <section className="home-view">
      <div className="hero">
        <div>
          <span className="eyebrow">
            COMMUNITY PLATFORM
          </span>

          <h1>
            Welcome back,{" "}
            {user?.name?.split(
              " "
            )[0] || "friend"}.
          </h1>

          <p>
            Connect, share, discover
            products and stay close
            to your community.
          </p>
        </div>

        <UserAvatar
          user={user}
          size={58}
        />
      </div>

      <div className="quick-grid">
        <button
          onClick={onCreatePost}
        >
          <span className="quick-icon blue">
            <Icon
              name="plus"
              size={22}
            />
          </span>

          <strong>
            Create post
          </strong>

          <small>
            Share with community
          </small>
        </button>

        <button
          onClick={onCreateProduct}
        >
          <span className="quick-icon green">
            <Icon
              name="box"
              size={22}
            />
          </span>

          <strong>
            Sell product
          </strong>

          <small>
            List something
          </small>
        </button>

        <button
          onClick={() =>
            go("inbox")
          }
        >
          <span className="quick-icon purple">
            <Icon
              name="message"
              size={22}
            />
          </span>

          <strong>
            Messages
          </strong>

          <small>
            Contact people
          </small>
        </button>

        <button
          onClick={() =>
            go("community")
          }
        >
          <span className="quick-icon orange">
            <Icon
              name="users"
              size={22}
            />
          </span>

          <strong>
            Community
          </strong>

          <small>
            See what's happening
          </small>
        </button>
      </div>

      <div className="stats-grid">
        <Stat
          label="Community posts"
          value={stats.posts}
        />

        <Stat
          label="Products"
          value={stats.products}
        />

        <Stat
          label="Messages"
          value={stats.messages}
        />
      </div>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              COMMUNITY
            </span>

            <h2>
              What's happening
            </h2>
          </div>

          <button
            className="text-button"
            onClick={() =>
              go("community")
            }
          >
            View all
          </button>
        </div>

        <MiniCommunityFeed
          notify={notify}
        />
      </section>
    </section>
  );
}

function Stat({
  label,
  value,
}) {
  return (
    <div className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

/* ======================================================
MINI COMMUNITY FEED
====================================================== */

function MiniCommunityFeed({
  notify,
}) {
  const [posts, setPosts] =
    useState([]);

  useEffect(() => {
    api("/feed?limit=3")
      .then((data) => {
        const list =
          Array.isArray(
            data?.data
          )
            ? data.data
            : [];

        setPosts(
          list.map(normalizePost)
        );
      })
      .catch(() => {
        setPosts(
          read(
            STORAGE.POSTS,
            []
          )
            .map(normalizePost)
            .slice(0, 3)
        );
      });
  }, []);

  if (!posts.length) {
    return (
      <div className="empty-mini">
        No community posts yet.
      </div>
    );
  }

  return (
    <div className="mini-feed">
      {posts.map((post) => (
        <div
          className="mini-post"
          key={post.id}
        >
          <UserAvatar
            user={post.author}
            size={35}
          />

          <div>
            <strong>
              {post.author
                ?.username ||
                post.author
                  ?.name ||
                "Community member"}
            </strong>

            <p>
              {post.title ||
                post.description ||
                "Shared something with the community."}
            </p>

            <span>
              {timeAgo(
                post.createdAt
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ======================================================
COMMUNITY
====================================================== */

function CommunityView({
  user,
  notify,
  onCreate,
}) {
  const [posts, setPosts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [hasMore, setHasMore] =
    useState(false);

  const [cursor, setCursor] =
    useState(null);

  const [query, setQuery] =
    useState("");

  const [category, setCategory] =
    useState("All");

  const sentinel =
    useRef(null);

  const load = useCallback(
    async (
      cursorValue = null
    ) => {
      if (!cursorValue) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const endpoint =
          cursorValue
            ? `/feed?cursor=${encodeURIComponent(
                cursorValue
              )}&limit=10`
            : "/feed?limit=10";

        const data =
          await api(endpoint);

        const incoming =
          Array.isArray(
            data?.data
          )
            ? data.data.map(
                normalizePost
              )
            : [];

        if (cursorValue) {
          setPosts(
            (previous) => {
              const ids =
                new Set(
                  previous.map(
                    (p) => p.id
                  )
                );

              return [
                ...previous,
                ...incoming.filter(
                  (p) =>
                    !ids.has(p.id)
                ),
              ];
            }
          );
        } else {
          setPosts(incoming);

          write(
            STORAGE.POSTS,
            incoming
          );
        }

        setCursor(
          data?.pagination
            ?.nextCursor ||
            null
        );

        setHasMore(
          Boolean(
            data?.pagination
              ?.hasMore
          )
        );
      } catch (error) {
        console.warn(error);

        if (!cursorValue) {
          setPosts(
            read(
              STORAGE.POSTS,
              []
            ).map(
              normalizePost
            )
          );
        }

        if (!cursorValue) {
          notify(
            "Showing cached community data"
          );
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

    const handler = () =>
      load();

    window.addEventListener(
      "carebox-refresh",
      handler
    );

    return () =>
      window.removeEventListener(
        "carebox-refresh",
        handler
      );
  }, [load]);

  useEffect(() => {
    const element =
      sentinel.current;

    if (!element) return;

    const observer =
      new IntersectionObserver(
        (entries) => {
          if (
            entries[0]?.isIntersecting &&
            hasMore &&
            !loadingMore
          ) {
            load(cursor);
          }
        },
        {
          rootMargin: "500px",
        }
      );

    observer.observe(element);

    return () =>
      observer.disconnect();
  }, [
    cursor,
    hasMore,
    loadingMore,
    load,
  ]);

  const filtered =
    posts.filter((post) => {
      const text =
        `${post.title} ${
          post.description
        } ${post.tags.join(
          " "
        )}`.toLowerCase();

      const matchesSearch =
        !query.trim() ||
        text.includes(
          query
            .trim()
            .toLowerCase()
        );

      if (!matchesSearch)
        return false;

      if (category === "All")
        return true;

      return post.tags.some(
        (tag) =>
          String(tag)
            .toLowerCase() ===
          category.toLowerCase()
      );
    });

  return (
    <section className="content-view">
      <PageHeading
        eyebrow="COMMUNITY"
        title="Community"
        description="Share updates, discover opportunities and connect with people."
        action={
          <button
            className="primary-button"
            onClick={onCreate}
          >
            <Icon
              name="plus"
              size={17}
            />
            Create post
          </button>
        }
      />

      <div className="community-tools">
        <div className="search-field">
          <Icon
            name="search"
            size={17}
          />

          <input
            value={query}
            onChange={(e) =>
              setQuery(
                e.target.value
              )
            }
            placeholder="Search posts..."
          />
        </div>

        <div className="filter-row">
          {[
            "All",
            "Donate",
            "Sell",
            "Buy",
            "Jobs",
            "Education",
          ].map((item) => (
            <button
              key={item}
              className={
                category === item
                  ? "filter active"
                  : "filter"
              }
              onClick={() =>
                setCategory(item)
              }
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
          {filtered.map(
            (post) => (
              <CommunityPost
                key={post.id}
                post={post}
                user={user}
                notify={notify}
              />
            )
          )}
        </div>
      ) : (
        <EmptyState
          icon="users"
          title={
            query
              ? "No matching posts"
              : "No posts yet"
          }
          description={
            query
              ? "Try another search."
              : "Be the first person to share something."
          }
          action={
            !query && (
              <button
                className="primary-button"
                onClick={onCreate}
              >
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
        {loadingMore &&
          "Loading more..."}

        {!hasMore &&
          posts.length > 0 &&
          "You're all caught up."}
      </div>
    </section>
  );
}

/* ======================================================
COMMUNITY POST
====================================================== */

function CommunityPost({
  post,
  user,
  notify,
}) {
  const [liked, setLiked] =
    useState(
      Boolean(post.likedByMe)
    );

  const [likeCount, setLikeCount] =
    useState(
      Number(
        post.likeCount || 0
      )
    );

  const [commentCount, setCommentCount] =
    useState(
      Number(
        post.commentCount || 0
      )
    );

  const [comments, setComments] =
    useState([]);

  const [commentOpen, setCommentOpen] =
    useState(false);

  const [commentText, setCommentText] =
    useState("");

  const [saved, setSaved] =
    useState(
      Boolean(
        read(
          STORAGE.SAVED,
          {}
        )[post.id]
      )
    );

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [expanded, setExpanded] =
    useState(false);

  const loadComments =
    async () => {
      try {
        const data =
          await api(
            `/posts/${post.id}/comments`
          );

        const list =
          Array.isArray(
            data?.data
          )
            ? data.data
            : Array.isArray(data)
            ? data
            : [];

        setComments(list);
      } catch {}
    };

  const toggleLike =
    async () => {
      const next = !liked;

      setLiked(next);

      setLikeCount(
        (value) =>
          Math.max(
            0,
            value +
              (next ? 1 : -1)
          )
      );

      try {
        await api(
          `/posts/${post.id}/like`,
          {
            method: "POST",
            body: JSON.stringify({
              liked: next,
            }),
          }
        );
      } catch {
        setLiked(!next);

        setLikeCount(
          (value) =>
            Math.max(
              0,
              value +
                (next
                  ? -1
                  : 1)
            )
        );

        notify(
          "Could not update like"
        );
      }
    };

  const toggleComments =
    async () => {
      const next =
        !commentOpen;

      setCommentOpen(next);

      if (
        next &&
        !comments.length
      ) {
        await loadComments();
      }
    };

  const addComment =
    async () => {
      const text =
        commentText.trim();

      if (!text) return;

      const optimistic = {
        id: `temp-${Date.now()}`,
        content: text,
        createdAt:
          new Date().toISOString(),
        author: user,
      };

      setComments(
        (items) => [
          ...items,
          optimistic,
        ]
      );

      setCommentText("");

      setCommentCount(
        (value) => value + 1
      );

      try {
        const data =
          await api(
            `/posts/${post.id}/comments`,
            {
              method: "POST",
              body: JSON.stringify({
                content: text,
              }),
            }
          );

        const savedComment =
          data?.data ||
          data?.comment;

        if (savedComment) {
          setComments(
            (items) =>
              items.map(
                (item) =>
                  item.id ===
                  optimistic.id
                    ? savedComment
                    : item
              )
          );
        }
      } catch {
        setComments(
          (items) =>
            items.filter(
              (item) =>
                item.id !==
                optimistic.id
            )
        );

        setCommentCount(
          (value) =>
            Math.max(
              0,
              value - 1
            )
        );

        notify(
          "Comment could not be saved"
        );
      }
    };

  const toggleSave = () => {
    const next = !saved;

    setSaved(next);

    const savedMap =
      read(
        STORAGE.SAVED,
        {}
      );

    if (next) {
      savedMap[post.id] = true;
    } else {
      delete savedMap[post.id];
    }

    write(
      STORAGE.SAVED,
      savedMap
    );

    api(
      `/posts/${post.id}/save`,
      {
        method: "POST",
        body: JSON.stringify({
          saved: next,
        }),
      }
    ).catch(() => {});
  };

  const deletePost =
    async () => {
      if (
        !window.confirm(
          "Delete this post?"
        )
      )
        return;

      try {
        await api(
          `/posts/${post.id}`,
          {
            method: "DELETE",
          }
        );

        window.dispatchEvent(
          new Event(
            "carebox-refresh"
          )
        );

        notify(
          "Post deleted"
        );
      } catch {
        notify(
          "Could not delete post"
        );
      }
    };

  const text =
    post.description || "";

  const long =
    text.length > 280;

  const displayText =
    !long || expanded
      ? text
      : `${text.slice(
          0,
          280
        )}...`;

  const author =
    post.author || {};

  const isOwner =
    String(
      author.id ||
        author._id ||
        ""
    ) ===
      String(
        user?.id ||
          user?._id ||
          "never"
      ) ||
    String(
      author.username ||
        ""
    ).toLowerCase() ===
      String(
        user?.username ||
          ""
      ).toLowerCase();

  return (
    <article className="post">
      <div className="post-head">
        <UserAvatar
          user={author}
          size={42}
        />

        <div className="post-author">
          <strong>
            {author.name ||
              author.username ||
              "Community member"}
          </strong>

          <span>
            {timeAgo(
              post.createdAt
            )}{" "}
            · Public
          </span>
        </div>

        <button
          className="more"
          onClick={() =>
            setMenuOpen(
              (value) => !value
            )
          }
        >
          <Icon
            name="more"
            size={20}
          />
        </button>

        {menuOpen && (
          <div className="post-menu">
            <button
              onClick={() => {
                toggleSave();
                setMenuOpen(false);
              }}
            >
              <Icon
                name="save"
                size={16}
              />
              {saved
                ? "Unsave"
                : "Save post"}
            </button>

            <button
              onClick={() => {
                navigator.clipboard
                  ?.writeText(
                    window.location.href
                  );

                setMenuOpen(false);

                notify(
                  "Post link copied"
                );
              }}
            >
              <Icon
                name="share"
                size={16}
              />
              Share
            </button>

            {isOwner && (
              <button
                className="danger"
                onClick={
                  deletePost
                }
              >
                <Icon
                  name="trash"
                  size={16}
                />
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {(post.title ||
        text) && (
        <div className="post-body">
          {post.title && (
            <h3>
              {post.title}
            </h3>
          )}

          {text && (
            <p>
              {displayText}

              {long && (
                <button
                  className="see-more"
                  onClick={() =>
                    setExpanded(
                      (value) =>
                        !value
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
          />
        </div>
      )}

      {post.tags.length >
        0 && (
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
        <span>
          {likeCount} likes
        </span>

        <span>
          {commentCount} comments
        </span>
      </div>

      <div className="post-actions">
        <button
          className={
            liked ? "liked" : ""
          }
          onClick={toggleLike}
        >
          <Icon
            name="heart"
            size={18}
            filled={liked}
          />
          Like
        </button>

        <button
          className={
            commentOpen
              ? "active"
              : ""
          }
          onClick={
            toggleComments
          }
        >
          <Icon
            name="comment"
            size={18}
          />
          Comment
        </button>

        <button
          onClick={() => {
            navigator.share?.({
              title:
                post.title ||
                "CareBox Community",
              text:
                text ||
                post.title,
              url:
                window.location
                  .href,
            });

            notify(
              "Share opened"
            );
          }}
        >
          <Icon
            name="send"
            size={18}
          />
          Share
        </button>
      </div>

      {commentOpen && (
        <div className="comments">
          {comments.map(
            (comment) => (
              <div
                className="comment"
                key={comment.id}
              >
                <UserAvatar
                  user={
                    comment.author
                  }
                  size={30}
                />

                <div className="comment-bubble">
                  <strong>
                    {comment
                      .author
                      ?.name ||
                      comment
                        .author
                        ?.username ||
                      "User"}
                  </strong>

                  <p>
                    {
                      comment.content
                    }
                  </p>

                  <span>
                    {timeAgo(
                      comment.createdAt
                    )}
                  </span>
                </div>
              </div>
            )
          )}

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
                if (
                  e.key ===
                  "Enter"
                ) {
                  addComment();
                }
              }}
              placeholder="Write a comment..."
            />

            <button
              onClick={
                addComment
              }
            >
              <Icon
                name="send"
                size={16}
              />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/* ======================================================
CREATE POST MODAL
====================================================== */

function CreatePostModal({
  user,
  onClose,
  onCreated,
}) {
  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [tags, setTags] =
    useState("");

  const [image, setImage] =
    useState(null);

  const [preview, setPreview] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const fileRef =
    useRef(null);

  const selectImage = (e) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setError(
        "Please choose an image."
      );
      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      setError(
        "Image must be smaller than 10MB."
      );
      return;
    }

    setImage(file);

    const reader =
      new FileReader();

    reader.onload = () =>
      setPreview(
        String(
          reader.result || ""
        )
      );

    reader.readAsDataURL(file);
  };

  const submit = async (
    e
  ) => {
    e.preventDefault();

    if (
      !title.trim() &&
      !description.trim() &&
      !image
    ) {
      setError(
        "Add text or an image."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const form =
        new FormData();

      if (title.trim())
        form.append(
          "title",
          title.trim()
        );

      if (
        description.trim()
      )
        form.append(
          "description",
          description.trim()
        );

      if (image)
        form.append(
          "image",
          image
        );

      form.append(
        "tags",
        JSON.stringify(
          tags
            .split(",")
            .map((item) =>
              item.trim()
            )
            .filter(Boolean)
        )
      );

      await api("/posts", {
        method: "POST",
        body: form,
      });

      onCreated();
      onClose();
    } catch (error) {
      setError(
        error.message ||
          "Unable to publish post."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Create post"
      subtitle="Share something with your community."
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={submit}
      >
        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <div
          className="image-picker"
          onClick={() =>
            fileRef.current?.click()
          }
        >
          {preview ? (
            <img
              src={preview}
              alt=""
            />
          ) : (
            <>
              <Icon
                name="image"
                size={30}
              />

              <strong>
                Add a photo
              </strong>

              <span>
                Optional
              </span>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={
            selectImage
          }
        />

        <input
          className="form-input"
          value={title}
          onChange={(e) =>
            setTitle(
              e.target.value
            )
          }
          placeholder="Post title"
          maxLength={160}
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
          maxLength={5000}
        />

        <input
          className="form-input"
          value={tags}
          onChange={(e) =>
            setTags(
              e.target.value
            )
          }
          placeholder="Tags: donate, jobs, education"
        />

        <div className="modal-user">
          <UserAvatar
            user={user}
            size={35}
          />

          <div>
            <strong>
              {user?.name ||
                user?.username ||
                "You"}
            </strong>

            <span>
              Public
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
    </Modal>
  );
}

/* ======================================================
PRODUCTS
====================================================== */

function ProductsView({
  user,
  notify,
  onCreate,
}) {
  const [products, setProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [query, setQuery] =
    useState("");

  const [category, setCategory] =
    useState("All");

  const load = useCallback(
    async () => {
      setLoading(true);

      try {
        const data =
          await api(
            "/products?limit=30"
          );

        const list =
          Array.isArray(
            data?.data
          )
            ? data.data
            : Array.isArray(data)
            ? data
            : [];

        setProducts(
          list.map(
            normalizeProduct
          )
        );

        write(
          STORAGE.PRODUCTS,
          list
        );
      } catch {
        setProducts(
          read(
            STORAGE.PRODUCTS,
            []
          ).map(
            normalizeProduct
          )
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load();

    const handler = () =>
      load();

    window.addEventListener(
      "carebox-refresh",
      handler
    );

    return () =>
      window.removeEventListener(
        "carebox-refresh",
        handler
      );
  }, [load]);

  const filtered =
    products.filter(
      (product) => {
        const matchesSearch =
          !query.trim() ||
          `${product.name} ${product.description} ${product.category}`
            .toLowerCase()
            .includes(
              query
                .trim()
                .toLowerCase()
            );

        const matchesCategory =
          category === "All" ||
          product.category ===
            category;

        return (
          matchesSearch &&
          matchesCategory
        );
      }
    );

  return (
    <section className="content-view">
      <PageHeading
        eyebrow="MARKETPLACE"
        title="Products"
        description="Discover products and opportunities from your community."
        action={
          <button
            className="primary-button"
            onClick={onCreate}
          >
            <Icon
              name="plus"
              size={17}
            />
            Sell something
          </button>
        }
      />

      <div className="community-tools">
        <div className="search-field">
          <Icon
            name="search"
            size={17}
          />

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

        <div className="filter-row">
          {[
            "All",
            "Clothes",
            "Books",
            "Electronics",
            "Food",
            "Services",
          ].map((item) => (
            <button
              key={item}
              className={
                category === item
                  ? "filter active"
                  : "filter"
              }
              onClick={() =>
                setCategory(item)
              }
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <ProductSkeletons />
      ) : filtered.length ? (
        <div className="product-grid">
          {filtered.map(
            (product) => (
              <ProductCard
                key={product.id}
                product={product}
                user={user}
                notify={notify}
              />
            )
          )}
        </div>
      ) : (
        <EmptyState
          icon="box"
          title="No products found"
          description="Try another search or category."
          action={
            <button
              className="primary-button"
              onClick={onCreate}
            >
              List a product
            </button>
          }
        />
      )}
    </section>
  );
}

function ProductCard({
  product,
  user,
  notify,
}) {
  const [contacting, setContacting] =
    useState(false);

  const contactSeller =
    async () => {
      const sellerId =
        product.seller?.id ||
        product.seller?._id;

      if (!sellerId) {
        notify(
          "Seller contact unavailable"
        );
        return;
      }

      setContacting(true);

      try {
        await api(
          "/conversations",
          {
            method: "POST",
            body: JSON.stringify({
              participantId:
                sellerId,
              productId:
                product.id,
            }),
          }
        );

        notify(
          "Conversation started"
        );
      } catch {
        notify(
          "Could not contact seller"
        );
      } finally {
        setContacting(false);
      }
    };

  return (
    <article className="product-card">
      <div className="product-image">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
          />
        ) : (
          <Icon
            name="box"
            size={40}
          />
        )}
      </div>

      <div className="product-info">
        <span className="product-category">
          {product.category}
        </span>

        <h3>
          {product.name}
        </h3>

        <p>
          {product.description ||
            "No description provided."}
        </p>

        <strong className="price">
          KES{" "}
          {product.price.toLocaleString()}
        </strong>

        <div className="seller">
          <UserAvatar
            user={
              product.seller
            }
            size={27}
          />

          <span>
            {product.seller
              ?.name ||
              product.seller
                ?.username ||
              "Community seller"}
          </span>
        </div>

        <button
          className="secondary-button full"
          disabled={contacting}
          onClick={
            contactSeller
          }
        >
          <Icon
            name="message"
            size={16}
          />

          {contacting
            ? "Opening..."
            : "Contact seller"}
        </button>
      </div>
    </article>
  );
}

/* ======================================================
CREATE PRODUCT
====================================================== */

function CreateProductModal({
  user,
  onClose,
  onCreated,
}) {
  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [price, setPrice] =
    useState("");

  const [category, setCategory] =
    useState("Other");

  const [image, setImage] =
    useState(null);

  const [preview, setPreview] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const fileRef =
    useRef(null);

  const chooseImage = (e) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    setImage(file);

    const reader =
      new FileReader();

    reader.onload = () =>
      setPreview(
        String(
          reader.result || ""
        )
      );

    reader.readAsDataURL(file);
  };

  const submit = async (
    e
  ) => {
    e.preventDefault();

    if (
      !name.trim() ||
      !price
    ) {
      setError(
        "Product name and price are required."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const form =
        new FormData();

      form.append(
        "name",
        name.trim()
      );

      form.append(
        "description",
        description.trim()
      );

      form.append(
        "price",
        price
      );

      form.append(
        "category",
        category
      );

      if (image) {
        form.append(
          "image",
          image
        );
      }

      await api("/products", {
        method: "POST",
        body: form,
      });

      onCreated();
      onClose();
    } catch (error) {
      setError(
        error.message ||
          "Unable to create product."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Sell a product"
      subtitle="List something for your community."
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={submit}
      >
        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <div
          className="image-picker"
          onClick={() =>
            fileRef.current?.click()
          }
        >
          {preview ? (
            <img
              src={preview}
              alt=""
            />
          ) : (
            <>
              <Icon
                name="image"
                size={28}
              />

              <strong>
                Product image
              </strong>

              <span>
                Optional
              </span>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          hidden
          type="file"
          accept="image/*"
          onChange={
            chooseImage
          }
        />

        <input
          className="form-input"
          placeholder="Product name"
          value={name}
          onChange={(e) =>
            setName(
              e.target.value
            )
          }
        />

        <input
          className="form-input"
          placeholder="Price in KES"
          type="number"
          min="0"
          value={price}
          onChange={(e) =>
            setPrice(
              e.target.value
            )
          }
        />

        <select
          className="form-input"
          value={category}
          onChange={(e) =>
            setCategory(
              e.target.value
            )
          }
        >
          <option>
            Clothes
          </option>
          <option>
            Books
          </option>
          <option>
            Electronics
          </option>
          <option>
            Food
          </option>
          <option>
            Services
          </option>
          <option>
            Other
          </option>
        </select>

        <textarea
          className="form-input textarea"
          placeholder="Description"
          value={description}
          onChange={(e) =>
            setDescription(
              e.target.value
            )
          }
        />

        <button
          className="primary-button full"
          disabled={saving}
        >
          {saving
            ? "Publishing..."
            : "Publish product"}
        </button>
      </form>
    </Modal>
  );
}

/* ======================================================
INBOX
====================================================== */

function InboxView({
  user,
  notify,
}) {
  const [conversations, setConversations] =
    useState([]);

  const [activeConversation, setActiveConversation] =
    useState(null);

  const [message, setMessage] =
    useState("");

  const [messages, setMessages] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const loadConversations =
    useCallback(async () => {
      try {
        const data =
          await api(
            "/conversations"
          );

        const list =
          Array.isArray(
            data?.data
          )
            ? data.data
            : Array.isArray(data)
            ? data
            : [];

        setConversations(list);
      } catch {}
      finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadConversations();

    const timer =
      setInterval(
        loadConversations,
        15000
      );

    return () =>
      clearInterval(timer);
  }, [
    loadConversations,
  ]);

  const openConversation =
    async (conversation) => {
      setActiveConversation(
        conversation
      );

      try {
        const data =
          await api(
            `/conversations/${conversation.id || conversation._id}/messages`
          );

        setMessages(
          Array.isArray(
            data?.data
          )
            ? data.data
            : []
        );
      } catch {
        setMessages([]);
      }
    };

  const sendMessage =
    async () => {
      const text =
        message.trim();

      if (
        !text ||
        !activeConversation
      )
        return;

      const id =
        activeConversation.id ||
        activeConversation._id;

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
            `/conversations/${id}/messages`,
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
      }
    };

  return (
    <section className="content-view inbox-view">
      <PageHeading
        eyebrow="MESSAGES"
        title="Inbox"
        description="Private conversations with people in your community."
      />

      <div className="inbox-layout">
        <div className="conversation-list">
          {loading ? (
            <div className="loading-box">
              Loading conversations...
            </div>
          ) : conversations.length ? (
            conversations.map(
              (conversation) => {
                const person =
                  conversation.otherUser ||
                  conversation.participant ||
                  {};

                return (
                  <button
                    key={
                      conversation.id ||
                      conversation._id
                    }
                    className={
                      activeConversation?.id ===
                        conversation.id
                        ? "conversation active"
                        : "conversation"
                    }
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
                        {conversation.lastMessage
                          ?.content ||
                          "Start a conversation"}
                      </p>

                      <span>
                        {timeAgo(
                          conversation.lastMessage
                            ?.createdAt
                        )}
                      </span>
                    </div>

                    {conversation.unreadCount >
                      0 && (
                      <b className="unread">
                        {conversation.unreadCount}
                      </b>
                    )}
                  </button>
                );
              }
            )
          ) : (
            <EmptyState
              icon="inbox"
              title="No conversations"
              description="Messages from buyers, sellers and community members will appear here."
            />
          )}
        </div>

        <div className="chat-panel">
          {!activeConversation ? (
            <div className="chat-empty">
              <Icon
                name="message"
                size={38}
              />

              <h3>
                Select a conversation
              </h3>

              <p>
                Your messages will
                appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <UserAvatar
                  user={
                    activeConversation.otherUser ||
                    activeConversation.participant
                  }
                  size={38}
                />

                <strong>
                  {activeConversation
                    .otherUser
                    ?.name ||
                    activeConversation
                      .participant
                      ?.name ||
                    "Conversation"}
                </strong>
              </div>

              <div className="messages">
                {messages.map(
                  (item) => {
                    const senderId =
                      item.sender
                        ?.id ||
                      item.sender
                        ?._id;

                    const mine =
                      String(
                        senderId
                      ) ===
                      String(
                        user?.id ||
                          user?._id
                      );

                    return (
                      <div
                        key={
                          item.id ||
                          item._id
                        }
                        className={
                          mine
                            ? "message mine"
                            : "message"
                        }
                      >
                        <div>
                          {item.content ||
                            item.text}
                        </div>

                        <span>
                          {timeAgo(
                            item.createdAt
                          )}
                        </span>
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
                    if (
                      e.key ===
                      "Enter"
                    ) {
                      sendMessage();
                    }
                  }}
                  placeholder="Write a message..."
                />

                <button
                  onClick={
                    sendMessage
                  }
                >
                  <Icon
                    name="send"
                    size={18}
                  />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ======================================================
NOTIFICATIONS
====================================================== */

function NotificationsView({
  notifications,
  unread,
  onRead,
}) {
  return (
    <section className="content-view">
      <PageHeading
        eyebrow="ACTIVITY"
        title="Notifications"
        description="Stay updated when people interact with you."
        action={
          unread > 0 && (
            <button
              className="secondary-button"
              onClick={onRead}
            >
              Mark all read
            </button>
          )
        }
      />

      <div className="notification-list">
        {notifications.length ? (
          notifications.map(
            (item) => (
              <div
                className={
                  !item.read &&
                  !item.isRead
                    ? "notification unread-notification"
                    : "notification"
                }
                key={
                  item.id ||
                  item._id
                }
              >
                <div className="notification-icon-box">
                  <Icon
                    name={
                      item.type ===
                      "message"
                        ? "message"
                        : item.type ===
                          "comment"
                        ? "comment"
                        : item.type ===
                          "like"
                        ? "heart"
                        : "bell"
                    }
                    size={18}
                  />
                </div>

                <div>
                  <strong>
                    {item.title ||
                      item.actor
                        ?.name ||
                      "CareBox activity"}
                  </strong>

                  <p>
                    {item.message ||
                      item.text ||
                      "You have a new notification."}
                  </p>

                  <span>
                    {timeAgo(
                      item.createdAt
                    )}
                  </span>
                </div>

                {!item.read &&
                  !item.isRead && (
                    <span className="notification-unread-dot" />
                  )}
              </div>
            )
          )
        ) : (
          <EmptyState
            icon="bell"
            title="You're all caught up"
            description="New activity will appear here."
          />
        )}
      </div>
    </section>
  );
}

/* ======================================================
SEARCH
====================================================== */

function SearchView({
  query,
  setQuery,
  go,
  notify,
}) {
  const [results, setResults] =
    useState({
      posts: [],
      products: [],
      users: [],
    });

  const [loading, setLoading] =
    useState(false);

  const search = async (
    value
  ) => {
    const q =
      value.trim();

    if (!q) {
      setResults({
        posts: [],
        products: [],
        users: [],
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
        posts:
          data?.data?.posts ||
          [],
        products:
          data?.data
            ?.products ||
          [],
        users:
          data?.data?.users ||
          [],
      });
    } catch {
      notify(
        "Search service unavailable"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer =
      setTimeout(
        () => search(query),
        400
      );

    return () =>
      clearTimeout(timer);
  }, [query]);

  return (
    <section className="content-view">
      <PageHeading
        eyebrow="DISCOVER"
        title="Search"
        description="Find people, posts and products across CareBox."
      />

      <div className="search-field large">
        <Icon
          name="search"
          size={18}
        />

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
            items={
              results.users
            }
            empty="No people found."
            render={(item) => (
              <div className="search-user">
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
                    {item.email ||
                      "CareBox member"}
                  </span>
                </div>
              </div>
            )}
          />

          <SearchSection
            title="Posts"
            items={
              results.posts
            }
            empty="No posts found."
            render={(item) => (
              <div className="search-result">
                <strong>
                  {item.title ||
                    item.description}
                </strong>

                <span>
                  {item.author
                    ?.username ||
                    "Community member"}
                </span>
              </div>
            )}
          />

          <SearchSection
            title="Products"
            items={
              results.products
            }
            empty="No products found."
            render={(item) => (
              <div className="search-result">
                <strong>
                  {item.name ||
                    item.title}
                </strong>

                <span>
                  KES{" "}
                  {Number(
                    item.price ||
                      0
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
  empty,
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
                  item.id ||
                  item._id ||
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
          {empty}
        </div>
      )}
    </section>
  );
}

/* ======================================================
PROFILE
====================================================== */

function ProfileView({
  user,
  setUser,
  notify,
}) {
  const [editing, setEditing] =
    useState(false);

  const [name, setName] =
    useState(
      user?.name || ""
    );

  const [username, setUsername] =
    useState(
      user?.username || ""
    );

  const [bio, setBio] =
    useState(
      user?.bio || ""
    );

  const [saving, setSaving] =
    useState(false);

  const [file, setFile] =
    useState(null);

  const [preview, setPreview] =
    useState(
      user?.avatar || ""
    );

  const fileRef =
    useRef(null);

  const chooseAvatar = (e) => {
    const selected =
      e.target.files?.[0];

    if (!selected) return;

    setFile(selected);

    const reader =
      new FileReader();

    reader.onload = () =>
      setPreview(
        String(
          reader.result || ""
        )
      );

    reader.readAsDataURL(
      selected
    );
  };

  const saveProfile =
    async () => {
      setSaving(true);

      try {
        const form =
          new FormData();

        form.append(
          "name",
          name
        );

        form.append(
          "username",
          username
        );

        form.append(
          "bio",
          bio
        );

        if (file) {
          form.append(
            "avatar",
            file
          );
        }

        const data =
          await api(
            "/users/me",
            {
              method: "PATCH",
              body: form,
            }
          );

        const updated =
          normalizeUser(
            data?.data ||
              data?.user
          );

        const finalUser =
          updated || {
            ...user,
            name,
            username,
            bio,
            avatar:
              preview ||
              user?.avatar ||
              "",
          };

        setUser(finalUser);

        write(
          STORAGE.USER,
          finalUser
        );

        setEditing(false);

        notify(
          "Profile updated"
        );
      } catch {
        notify(
          "Could not update profile"
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <section className="profile-page">
      <div className="profile-cover" />

      <div className="profile-main">
        <div className="profile-avatar-large">
          {preview ? (
            <img
              src={preview}
              alt=""
            />
          ) : (
            initials(user)
          )}

          {editing && (
            <button
              onClick={() =>
                fileRef.current?.click()
              }
            >
              <Icon
                name="edit"
                size={15}
              />
            </button>
          )}
        </div>

        <input
          hidden
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={
            chooseAvatar
          }
        />

        <div className="profile-title">
          <div>
            <h1>
              {user?.name ||
                user?.username ||
                "User"}
            </h1>

            <span>
              @{user?.username ||
                "user"}
            </span>
          </div>

          {!editing && (
            <button
              className="secondary-button"
              onClick={() =>
                setEditing(true)
              }
            >
              <Icon
                name="edit"
                size={16}
              />
              Edit profile
            </button>
          )}
        </div>

        {editing ? (
          <div className="profile-form">
            <input
              className="form-input"
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value
                )
              }
              placeholder="Full name"
            />

            <input
              className="form-input"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value
                )
              }
              placeholder="Username"
            />

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
                onClick={
                  saveProfile
                }
              >
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
              {user?.postCount ||
                0}
            </strong>
            <span>Posts</span>
          </div>

          <div>
            <strong>
              {user?.productCount ||
                0}
            </strong>
            <span>Products</span>
          </div>

          <div>
            <strong>
              {user?.followersCount ||
                0}
            </strong>
            <span>Followers</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ======================================================
SETTINGS
====================================================== */

function SettingsView({
  user,
  setUser,
  logout,
  notify,
}) {
  const [notifications, setNotifications] =
    useState(
      user?.settings
        ?.notifications !==
        false
    );

  const [publicProfile, setPublicProfile] =
    useState(
      user?.settings
        ?.publicProfile !==
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

          write(
            STORAGE.USER,
            updated
          );
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
          onClick={
            saveSettings
          }
        >
          Save settings
        </button>
      </div>

      <div className="danger-zone">
        <h3>
          Account
        </h3>

        <p>
          Signing out removes the
          local session from this
          device.
        </p>

        <button
          className="danger-button"
          onClick={logout}
        >
          <Icon
            name="logout"
            size={17}
          />
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
        className={
          checked
            ? "switch checked"
            : "switch"
        }
        onClick={() =>
          onChange(!checked)
        }
      >
        <span />
      </button>
    </div>
  );
}

/* ======================================================
SHARED UI
====================================================== */

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">
          {eyebrow}
        </span>

        <h1>{title}</h1>

        <p>
          {description}
        </p>
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
      <div className="empty-state-icon">
        <Icon
          name={icon}
          size={30}
        />
      </div>

      <h2>{title}</h2>

      <p>{description}</p>

      {action}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (
          e.target ===
          e.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2>{title}</h2>

            <span>
              {subtitle}
            </span>
          </div>

          <button
            className="modal-close"
            onClick={onClose}
          >
            <Icon
              name="close"
              size={19}
            />
          </button>
        </div>

        {children}
      </div>
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

function ProductSkeletons() {
  return (
    <div className="product-grid">
      {[1, 2, 3, 4].map(
        (item) => (
          <div
            className="product-card skeleton"
            key={item}
          >
            <div className="skeleton-media" />

            <div className="skeleton-line" />
            <div className="skeleton-line medium" />
          </div>
        )
      )}
    </div>
  );
}

/* ======================================================
STYLES
====================================================== */

const styles = `
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
  background: #eef1f3;
  color: #15171a;
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
  opacity: .6;
  cursor: not-allowed;
}

input,
textarea,
select {
  outline: none;
}

img {
  max-width: 100%;
}

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
  border-bottom: 1px solid #e9ebed;
  backdrop-filter: blur(14px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  background: transparent;
  color: #111827;
  font-weight: 800;
  font-size: 17px;
}

.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: #1a73e8;
  color: white;
  font-size: 15px;
}

.top-search {
  width: min(450px, 50vw);
  height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 13px;
  border-radius: 20px;
  background: #f3f5f6;
  color: #73777b;
}

.top-search input {
  width: 100%;
  border: 0;
  background: transparent;
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

.notification-icon {
  position: relative;
}

.notification-count {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: #e53935;
  color: white;
  border: 2px solid white;
  font-size: 7px;
  font-weight: 800;
}

.avatar {
  object-fit: cover;
  border-radius: 50%;
  display: block;
}

.avatar-initials {
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #e7edf3;
  color: #27313b;
  font-weight: 700;
}

.profile-dropdown {
  position: fixed;
  z-index: 200;
  right: 18px;
  top: 57px;
  width: 245px;
  padding: 8px;
  background: white;
  border: 1px solid #e5e7e9;
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
  color: #d43b3b;
}

.page {
  width: 100%;
  max-width: 900px;
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
  color: #1a73e8;
  font-size: 9px;
  letter-spacing: 1.3px;
  font-weight: 800;
}

.page-heading h1 {
  margin: 0;
  font-size: 28px;
  letter-spacing: -.7px;
}

.page-heading p {
  max-width: 560px;
  margin: 7px 0 0;
  color: #777d82;
  font-size: 12px;
  line-height: 18px;
}

.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30px;
  border-radius: 20px;
  background: white;
  border: 1px solid #e7e9eb;
  margin-bottom: 18px;
}

.hero h1 {
  margin: 0;
  font-size: 28px;
  letter-spacing: -.8px;
}

.hero p {
  max-width: 520px;
  margin: 8px 0 0;
  color: #777;
  font-size: 12px;
  line-height: 19px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 10px;
  margin-bottom: 15px;
}

.quick-grid button {
  min-height: 125px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 5px;
  background: white;
  border: 1px solid #e7e9eb;
  border-radius: 15px;
  text-align: left;
  transition: .18s ease;
}

.quick-grid button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0,0,0,.06);
}

.quick-grid strong {
  font-size: 12px;
}

.quick-grid small {
  color: #888;
  font-size: 9px;
}

.quick-icon {
  width: 39px;
  height: 39px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  margin-bottom: 5px;
}

.quick-icon.blue {
  background: #edf4ff;
  color: #1a73e8;
}

.quick-icon.green {
  background: #ebfaef;
  color: #2fa956;
}

.quick-icon.purple {
  background: #f3edff;
  color: #7449d8;
}

.quick-icon.orange {
  background: #fff2e5;
  color: #e37d23;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 10px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border: 1px solid #e7e9eb;
  border-radius: 13px;
  padding: 16px;
}

.stat-card strong {
  display: block;
  font-size: 22px;
}

.stat-card span {
  color: #85898d;
  font-size: 9px;
}

.home-section {
  margin-top: 20px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-heading h2 {
  margin: 0;
  font-size: 18px;
}

.text-button {
  background: transparent;
  color: #1a73e8;
  font-size: 10px;
  font-weight: 700;
}

.mini-feed {
  background: white;
  border: 1px solid #e7e9eb;
  border-radius: 15px;
  overflow: hidden;
}

.mini-post {
  display: flex;
  gap: 10px;
  padding: 13px;
  border-bottom: 1px solid #eee;
}

.mini-post:last-child {
  border-bottom: 0;
}

.mini-post strong {
  font-size: 10px;
}

.mini-post p {
  margin: 3px 0;
  font-size: 10px;
  color: #333;
}

.mini-post span {
  color: #999;
  font-size: 8px;
}

.community-tools {
  margin-bottom: 15px;
}

.search-field {
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 13px;
  border-radius: 10px;
  border: 1px solid #dedfe1;
  background: white;
  color: #777;
}

.search-field.large {
  height: 48px;
  margin-bottom: 20px;
  border-radius: 13px;
}

.search-field input {
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  font-size: 11px;
}

.filter-row {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 9px 0 3px;
}

.filter-row::-webkit-scrollbar {
  display: none;
}

.filter {
  flex: 0 0 auto;
  height: 30px;
  padding: 0 13px;
  border-radius: 16px;
  background: #f1f3f4;
  color: #666;
  font-size: 9px;
}

.filter.active {
  background: #1a73e8;
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
  border: 1px solid #e5e7e9;
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
  width: 30px;
  height: 30px;
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
  z-index: 20;
  top: 48px;
  right: 13px;
  width: 160px;
  padding: 5px;
  background: white;
  border: 1px solid #e5e7e9;
  border-radius: 11px;
  box-shadow: 0 12px 30px rgba(0,0,0,.12);
}

.post-menu button {
  width: 100%;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 9px;
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
  color: #d33;
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
  color: #1a73e8;
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

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 15px 7px;
}

.tags span {
  color: #1a73e8;
  font-size: 9px;
}

.engagement-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 15px;
  color: #85898d;
  font-size: 8px;
}

.post-actions {
  margin: 0 15px;
  min-height: 40px;
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
  color: #1a73e8;
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
  height: 34px;
  padding: 0 11px;
  border: 1px solid #ddd;
  border-radius: 18px;
  font-size: 9px;
}

.comment-compose button,
.message-compose button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #1a73e8;
  color: white;
}

.no-comments {
  padding: 10px;
  text-align: center;
  color: #999;
  font-size: 9px;
}

.primary-button,
.secondary-button,
.danger-button {
  height: 38px;
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
  background: #1a73e8;
  color: white;
}

.primary-button:hover {
  background: #1769d2;
}

.secondary-button {
  background: #f1f3f4;
  color: #444;
}

.danger-button {
  background: #fff0f0;
  color: #d33434;
}

.primary-button.full,
.secondary-button.full {
  width: 100%;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 12px;
}

.product-card {
  background: white;
  border: 1px solid #e5e7e9;
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

.product-category {
  color: #1a73e8;
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
}

.product-info h3 {
  margin: 4px 0;
  font-size: 12px;
}

.product-info p {
  height: 32px;
  overflow: hidden;
  margin: 0 0 8px;
  color: #777;
  font-size: 9px;
  line-height: 15px;
}

.price {
  display: block;
  margin-bottom: 10px;
  font-size: 14px;
}

.seller {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  color: #666;
  font-size: 8px;
}

.inbox-layout {
  display: grid;
  grid-template-columns: 290px 1fr;
  min-height: 580px;
  background: white;
  border: 1px solid #e5e7e9;
  border-radius: 15px;
  overflow: hidden;
}

.conversation-list {
  border-right: 1px solid #eee;
  overflow-y: auto;
}

.conversation {
  position: relative;
  width: 100%;
  display: flex;
  gap: 9px;
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
  background: white;
  text-align: left;
}

.conversation:hover,
.conversation.active {
  background: #f4f8fd;
}

.conversation > div {
  min-width: 0;
  flex: 1;
}

.conversation strong {
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

.conversation span {
  color: #aaa;
  font-size: 7px;
}

.unread {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #1a73e8;
  color: white;
  font-size: 7px;
}

.chat-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-header {
  min-height: 58px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 9px;
  border-bottom: 1px solid #eee;
  font-size: 11px;
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #aaa;
  text-align: center;
}

.chat-empty h3 {
  margin: 10px 0 4px;
  color: #444;
  font-size: 13px;
}

.chat-empty p {
  margin: 0;
  font-size: 9px;
}

.messages {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
}

.message {
  max-width: 75%;
  margin-bottom: 9px;
}

.message > div {
  padding: 9px 11px;
  border-radius: 13px 13px 13px 3px;
  background: #f0f2f3;
  font-size: 10px;
  line-height: 15px;
}

.message span {
  display: block;
  margin-top: 3px;
  color: #aaa;
  font-size: 7px;
}

.message.mine {
  margin-left: auto;
}

.message.mine > div {
  background: #1a73e8;
  color: white;
  border-radius: 13px 13px 3px 13px;
}

.message.mine span {
  text-align: right;
}

.message-compose {
  padding: 10px;
  display: flex;
  gap: 7px;
  border-top: 1px solid #eee;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.notification {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 13px;
  border-radius: 12px;
  background: white;
  border: 1px solid #e7e9eb;
}

.unread-notification {
  background: #f7fbff;
}

.notification-icon-box {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: #edf4ff;
  color: #1a73e8;
}

.notification strong {
  font-size: 10px;
}

.notification p {
  margin: 3px 0;
  color: #666;
  font-size: 9px;
  line-height: 14px;
}

.notification span {
  color: #999;
  font-size: 7px;
}

.notification-unread-dot {
  position: absolute;
  right: 12px;
  top: 14px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #1a73e8;
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.search-section {
  background: white;
  border: 1px solid #e6e8e9;
  border-radius: 13px;
  padding: 14px;
}

.search-section h2 {
  margin: 0 0 10px;
  font-size: 13px;
}

.search-user,
.search-result {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.search-result {
  justify-content: space-between;
}

.search-user strong,
.search-result strong {
  display: block;
  font-size: 10px;
}

.search-user span,
.search-result span {
  display: block;
  margin-top: 3px;
  color: #888;
  font-size: 8px;
}

.small-empty {
  color: #999;
  font-size: 9px;
}

.profile-page {
  max-width: 760px;
  margin: 0 auto;
  background: white;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid #e5e7e9;
}

.profile-cover {
  height: 145px;
  background:
    linear-gradient(
      135deg,
      #1a73e8,
      #65a9ef
    );
}

.profile-main {
  position: relative;
  padding: 0 25px 30px;
}

.profile-avatar-large {
  position: relative;
  width: 100px;
  height: 100px;
  margin-top: -50px;
  border: 5px solid white;
  border-radius: 50%;
  background: #e8edf2;
  display: grid;
  place-items: center;
  color: #34414d;
  font-size: 29px;
  font-weight: 800;
  overflow: visible;
}

.profile-avatar-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.profile-avatar-large button {
  position: absolute;
  right: -3px;
  bottom: 2px;
  width: 29px;
  height: 29px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #1a73e8;
  color: white;
  border: 3px solid white;
}

.profile-title {
  margin-top: 13px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.profile-title h1 {
  margin: 0;
  font-size: 23px;
}

.profile-title span {
  display: block;
  margin-top: 3px;
  color: #888;
  font-size: 9px;
}

.profile-info {
  margin-top: 15px;
}

.profile-info p {
  margin: 0 0 6px;
  color: #444;
  font-size: 10px;
  line-height: 17px;
}

.profile-info > span {
  color: #888;
  font-size: 9px;
}

.profile-form {
  max-width: 500px;
  margin-top: 15px;
}

.profile-actions {
  display: flex;
  gap: 7px;
  justify-content: flex-end;
}

.profile-stats {
  display: flex;
  gap: 35px;
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px solid #eee;
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

.settings-card,
.danger-zone {
  background: white;
  border: 1px solid #e5e7e9;
  border-radius: 14px;
  padding: 15px;
  margin-bottom: 15px;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  align-items: center;
  padding: 14px 0;
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
  max-width: 450px;
  color: #888;
  font-size: 8px;
  line-height: 13px;
}

.switch {
  width: 42px;
  height: 24px;
  flex-shrink: 0;
  padding: 3px;
  border-radius: 20px;
  background: #d7dadd;
  text-align: left;
}

.switch span {
  width: 18px;
  height: 18px;
  display: block;
  border-radius: 50%;
  background: white;
  transition: .2s;
}

.switch.checked {
  background: #1a73e8;
}

.switch.checked span {
  transform: translateX(18px);
}

.danger-zone h3 {
  margin: 0;
  font-size: 12px;
}

.danger-zone p {
  color: #888;
  font-size: 9px;
  line-height: 14px;
}

.empty-state {
  min-height: 300px;
  padding: 50px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.empty-state-icon {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #edf4ff;
  color: #1a73e8;
}

.empty-state h2 {
  margin: 13px 0 5px;
  font-size: 16px;
}

.empty-state p {
  max-width: 300px;
  margin: 0 0 14px;
  color: #888;
  font-size: 10px;
  line-height: 16px;
}

.empty-mini {
  padding: 35px;
  background: white;
  border: 1px solid #e7e9eb;
  border-radius: 15px;
  text-align: center;
  color: #999;
  font-size: 10px;
}

.feed-end {
  min-height: 60px;
  padding: 25px;
  text-align: center;
  color: #aaa;
  font-size: 9px;
}

.loading-box {
  padding: 40px;
  text-align: center;
  color: #999;
  font-size: 10px;
}

.skeleton {
  overflow: hidden;
}

.skeleton-head {
  display: flex;
  gap: 10px;
  padding: 15px;
}

.skeleton-circle,
.skeleton-line,
.skeleton-media {
  background:
    linear-gradient(
      90deg,
      #eee,
      #f8f8f8,
      #eee
    );
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

.skeleton-circle {
  width: 42px;
  height: 42px;
  border-radius: 50%;
}

.skeleton-line {
  width: 80%;
  height: 9px;
  margin: 9px 15px;
  border-radius: 5px;
}

.skeleton-line.wide {
  width: 120px;
  margin: 7px 0;
}

.skeleton-line.small {
  width: 70px;
  margin: 0;
}

.skeleton-line.medium {
  width: 50%;
}

.skeleton-media {
  width: calc(100% - 30px);
  height: 200px;
  margin: 15px;
  border-radius: 10px;
}

@keyframes shimmer {
  from {
    background-position: 200% 0;
  }

  to {
    background-position: -200% 0;
  }
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 500;
  padding: 15px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0,0,0,.48);
  backdrop-filter: blur(3px);
}

.modal {
  width: min(580px, 100%);
  max-height: 92vh;
  overflow-y: auto;
  background: white;
  border-radius: 19px 19px 12px 12px;
  box-shadow: 0 -15px 50px rgba(0,0,0,.2);
  animation: modalUp .2s ease;
}

@keyframes modalUp {
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
  min-height: 62px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  font-size: 16px;
}

.modal-header span {
  display: block;
  margin-top: 3px;
  color: #888;
  font-size: 8px;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #f1f2f3;
}

.modal-form {
  padding: 15px;
}

.form-error {
  margin-bottom: 10px;
  padding: 9px;
  border-radius: 8px;
  background: #fff0f0;
  color: #c33;
  font-size: 9px;
}

.image-picker {
  min-height: 150px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1.5px dashed #d5d9dc;
  border-radius: 11px;
  background: #fafbfc;
  color: #777;
  cursor: pointer;
  overflow: hidden;
}

.image-picker img {
  width: 100%;
  max-height: 260px;
  object-fit: contain;
}

.image-picker strong {
  color: #444;
  font-size: 11px;
}

.image-picker span {
  font-size: 8px;
}

.form-input {
  width: 100%;
  min-height: 42px;
  margin-bottom: 9px;
  padding: 0 11px;
  border: 1px solid #ddd;
  border-radius: 9px;
  background: white;
  font-size: 10px;
}

.form-input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 3px rgba(26,115,232,.08);
}

.textarea {
  height: 100px;
  padding: 10px 11px;
  resize: vertical;
}

.modal-user {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 5px 0 12px;
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
  color: #888;
  font-size: 7px;
}

.floating-button {
  position: fixed;
  z-index: 120;
  right: 28px;
  bottom: 28px;
  width: 51px;
  height: 51px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #1a73e8;
  color: white;
  box-shadow: 0 8px 25px rgba(26,115,232,.35);
}

.bottom-nav {
  position: fixed;
  z-index: 110;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 64px;
  display: none;
  grid-template-columns: repeat(4,1fr);
  background: rgba(255,255,255,.98);
  border-top: 1px solid #e6e8ea;
  backdrop-filter: blur(12px);
}

.nav-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: transparent;
  color: #666;
  font-size: 8px;
}

.nav-button.active {
  color: #1a73e8;
  font-weight: 700;
}

.refresh-indicator {
  position: fixed;
  z-index: 1000;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  padding: 7px 12px;
  border-radius: 20px;
  background: #222;
  color: white;
  font-size: 8px;
}

.toast {
  position: fixed;
  z-index: 1000;
  left: 50%;
  bottom: 25px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 15px;
  border-radius: 22px;
  background: #202326;
  color: white;
  box-shadow: 0 8px 25px rgba(0,0,0,.2);
  font-size: 9px;
}

@media (max-width: 760px) {
  .topbar {
    padding: 0 12px;
    gap: 8px;
  }

  .brand span:last-child {
    display: none;
  }

  .top-search {
    flex: 1;
    width: auto;
  }

  .page {
    padding: 20px 12px 90px;
  }

  .quick-grid {
    grid-template-columns: repeat(2,1fr);
  }

  .product-grid {
    grid-template-columns: repeat(2,1fr);
  }

  .inbox-layout {
    grid-template-columns: 1fr;
  }

  .conversation-list {
    max-height: 250px;
    border-right: 0;
    border-bottom: 1px solid #eee;
  }

  .chat-panel {
    min-height: 400px;
  }

  .bottom-nav {
    display: grid;
  }

  .floating-button {
    right: 18px;
    bottom: 78px;
    width: 47px;
    height: 47px;
  }

  .profile-dropdown {
    right: 10px;
  }
}

@media (max-width: 480px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-heading h1 {
    font-size: 24px;
  }

  .hero {
    padding: 20px;
  }

  .hero h1 {
    font-size: 22px;
  }

  .stats-grid {
    gap: 7px;
  }

  .stat-card {
    padding: 12px;
  }

  .stat-card strong {
    font-size: 18px;
  }

  .product-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .product-info {
    padding: 9px;
  }

  .product-info h3 {
    font-size: 10px;
  }

  .price {
    font-size: 12px;
  }

  .profile-main {
    padding-left: 15px;
    padding-right: 15px;
  }

  .profile-title {
    flex-direction: column;
  }

  .modal-backdrop {
    padding: 0;
  }

  .modal {
    border-radius: 18px 18px 0 0;
    max-height: 95vh;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
}
`;