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
      // App already open on another page: bring it forward on the target
      // page instead of stacking a second window.
      for (const client of clientList) {
        if ("navigate" in client && "focus" in client) {
          try {
            const navigated = await client.navigate(url);
            if (navigated) return navigated.focus();
          } catch {}
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
