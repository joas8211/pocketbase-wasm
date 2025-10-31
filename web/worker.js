importScripts("/fs.js");
importScripts("/wasm_exec.js");

const go = new Go();

WebAssembly.instantiateStreaming(fetch("/pocketbase.wasm"), go.importObject)
  .then((result) => {
    postMessage({ type: "ready" });
    go.run(result.instance);
  })
  .catch((error) => console.error(error));

self.output = (value) => {
  self.postMessage({ type: "output", value });
};

const queue = [];
let handle = (request, callback) => {
  queue.push({ request, callback });
};
self.ON_POCKETBASE_READY = (h) => {
  handle = h;
  for (const { request, callback } of queue) {
    handle(request, callback);
  }
};

self.addEventListener("message", (event) => {
  if (event.data.type !== "init") {
    return;
  }

  const [port] = event.ports;
  port.addEventListener("message", (event) => {
    if (event.data.type !== "request") {
      return;
    }

    const { id, request } = event.data;
    handle(request, (response) => {
      port.postMessage({ type: "response", id, response });
    });
  });
  port.start();
});
