// Serves the FCM service worker at the root scope (/firebase-messaging-sw.js)
// with the public Firebase config injected from env — so there is nothing to
// edit by hand. Service workers can't read process.env, hence this route.

export const dynamic = "force-static";

export function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const body = `
importScripts("https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});

const messaging = firebase.messaging();

// Background messages (tab closed / not focused)
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "MoviePing";
  const options = {
    body: (payload.notification && payload.notification.body) || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge.png",
    image: payload.data && payload.data.poster ? payload.data.poster : undefined,
    data: { url: (payload.data && payload.data.url) || "/dashboard" },
    tag: payload.data && payload.data.movieId ? "movie-" + payload.data.movieId : undefined,
  };
  self.registration.showNotification(title, options);
});

// Click handling — focus an existing tab or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
`.trim();

  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
