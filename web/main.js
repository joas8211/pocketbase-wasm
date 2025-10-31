const output = document.querySelector("#output");
const print = (value) => {
  const isScrolledDown =
    output.scrollTop + output.clientHeight === output.scrollHeight;
  const line = document.createElement("span");
  line.textContent = value + "\n";
  output.appendChild(line);
  if (isScrolledDown) {
    output.scrollTop = output.scrollHeight - output.clientHeight;
  }
};

const init = () => {
  const channel = new MessageChannel();
  sw.postMessage({ type: "init" }, [channel.port1]);
  worker.postMessage({ type: "init" }, [channel.port2]);
};

let sw;
let worker;
let controller;
const startServer = async () =>
  new Promise((resolve) => {
    print("Loading PocketBase WASM...");
    if (worker) worker.terminate();
    worker = new Worker("/worker.js");
    worker.addEventListener("message", (event) => {
      const { type, value } = event.data;
      if (type === "ready") {
        const channel = new MessageChannel();
        worker.postMessage({ type: "init" }, [channel.port2]);
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((registration) => {
            sw = registration.installing ?? registration.active;
            init();
            registration.addEventListener("updatefound", () => {
              sw = registration.installing;
              init();
            });

            controller = new AbortController();
            resolve(
              fetch("/api/health", { signal: controller.signal }).then(
                (res) => {
                  controller = undefined;
                  if (!res.ok) {
                    throw new Error("Non-ok response");
                  }
                },
              ),
            );
          });
      } else if (type === "output") {
        print(value);
      }
    });
  });

const stopServer = () => {
  if (sw) sw.postMessage({ type: "close" });
  if (worker) worker.terminate();
  if (controller) controller.abort();
  sw = undefined;
  worker = undefined;
  controller = undefined;
};

const resetServer = async () => {
  stopServer();
  const root = await navigator.storage.getDirectory();
  await root.removeEntry("pb_data", { recursive: true });
};

const iframe = document.querySelector("iframe");
if (window.name === "server") {
  document.querySelector("#reset-button").hidden = false;
  document.querySelector("#output-button").hidden = false;
  document.querySelector("#output-button").open = true;
  startServer().then(() => {
    setTimeout(() => {
      document.querySelector("#output-button").open = false;
    }, 1000);
    iframe.src = location.href;
  });
} else {
  document.querySelector("#start-button").hidden = false;
  document.querySelector("#info-button").open = true;
  navigator.storage.getDirectory().then(async (root) => {
    const keys = await Array.fromAsync(root.keys());
    if (keys.includes("pb_data")) {
      document.querySelector("#reset-button").hidden = false;
    }
  });
}

document.querySelector("#start-button").addEventListener("click", () => {
  window.name = "server";
  document.querySelector("#info-button").open = false;
  document.querySelector("#start-button").hidden = true;
  document.querySelector("#reset-button").hidden = false;
  document.querySelector("#output-button").hidden = false;
  document.querySelector("#output-button").open = true;
  startServer()
    .then(() => {
      setTimeout(() => {
        document.querySelector("#output-button").open = false;
      }, 1000);
      iframe.src = location.href;
    })
    .catch((error) => {
      console.error(error);
      print(error);
      stopServer();
    });
});

document.querySelector("#reset-button").addEventListener("click", () => {
  resetServer().then(() => {
    window.name = "";
    output.innerHTML = "";
    document.querySelector("#start-button").hidden = false;
    document.querySelector("#reset-button").hidden = true;
    document.querySelector("#output-button").hidden = true;
    document.querySelector("#output-button").open = false;
    iframe.src = "about:blank";
  });
});

document.querySelector("#info-button").addEventListener("click", () => {
  document.querySelector("#output-button").open = false;
});

document.querySelector("#output-button").addEventListener("click", () => {
  document.querySelector("#info-button").open = false;
});

window.addEventListener("beforeunload", () => {
  stopServer();
});
