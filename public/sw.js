self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "EFK members", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "EFK members";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if (client.url.endsWith(url) && "focus" in client) return client.focus();
      }
      // App already open on another page: bring it forward, then move it to
      // the target page. focus() must come first - it's only allowed while
      // the tap's user activation lasts, which a slow navigate() outlives
      // (Android then switched the page in the background without showing it).
      for (const client of clientList) {
        if ("focus" in client) {
          try {
            const focused = await client.focus();
            if (focused && "navigate" in focused) {
              try {
                await focused.navigate(url);
                return;
              } catch {}
            }
            break;
          } catch {}
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
