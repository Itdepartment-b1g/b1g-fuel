/* Optional interaction check using an installed Chromium browser and the existing esbuild dependency. */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import * as esbuild from "esbuild";

async function main() {
  const browserPath = process.env.TABLE_BROWSER_PATH || [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/chromium", "/usr/bin/google-chrome",
  ].find(file => fs.existsSync(file));
  if (!browserPath) throw new Error("Set TABLE_BROWSER_PATH to an installed Chromium browser.");
  const root = path.resolve(".next/table-browser");
  fs.mkdirSync(root, { recursive: true });
  const profile = fs.mkdtempSync(path.join(root, "profile-"));
  const entry = path.join(root, "entry.tsx");
  fs.writeFileSync(entry, `
    import { createRoot } from "react-dom/client";
    import { DataTable } from "../../src/components/common/data-table";
    import { useState } from "react";
    import { SearchQuickFilter } from "../../src/components/common/search-quick-filter";
    import { createQuickFilterState } from "../../src/lib/quick-filter";
    function ToolbarFixture() {
      const [value, setValue] = useState("");
      const [filters, setFilters] = useState(() => createQuickFilterState({status:"all"}));
      const [calls, setCalls] = useState(0);
      return <section id="toolbar-fixture" className="mb-8 rounded-xl border p-4">
        <SearchQuickFilter searchValue={value} onSearchValueChange={setValue}
          onSearch={query => { setCalls(count => count + 1); window.lastSearch = query; return new Promise(resolve => { window.finishSearch = resolve; }); }}
          filter={{value:filters,onChange:setFilters,fields:[],statusOptions:[{value:"all",label:"All users"}]}} />
        <output id="search-calls" className="sr-only">{calls}</output>
      </section>;
    }
    const rows = [{id:"one",name:"Freeze only",created_at:"2026-10-12"}];
    const columns = [{id:"name",header:"Freeze Only",freezable:true,value:row=>row.name}];
    createRoot(document.getElementById("root")).render(<main style={{maxWidth:1100,margin:"auto",padding:24}}>
      <h1 style={{fontSize:26,marginBottom:20}}>Reusable list controls</h1><ToolbarFixture />
      <DataTable data={rows} columns={columns} rowKey={row=>row.id} caption="Freeze without sorting" />
      <DataTable data={[]} columns={columns} rowKey={row=>row.id} caption="Empty table" />
      <DataTable data={[]} columns={columns} rowKey={row=>row.id} caption="Loading table" loading />
    </main>);
  `);
  await esbuild.build({ entryPoints: [entry], outfile: path.join(root, "bundle.js"), bundle: true,
    platform: "browser", jsx: "automatic", tsconfig: "tsconfig.json", define: { "process.env.NODE_ENV": '"development"' } });
  const cssDir = path.resolve(".next/static/chunks");
  const css = fs.existsSync(cssDir) ? fs.readdirSync(cssDir).filter(file => file.endsWith(".css")).map(file => fs.readFileSync(path.join(cssDir, file))).join("\n") : "";
  const server = http.createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(fs.readFileSync(path.join(root, "bundle.js"))); }
    else if (req.url === "/theme.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
    else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/theme.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = spawn(browserPath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", "--user-data-dir=" + profile], { windowsHide: true, stdio: "ignore" });
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let socket;
  try {
    const portFile = path.join(profile, "DevToolsActivePort");
    for (let attempt = 0; attempt < 100 && !fs.existsSync(portFile); attempt++) await sleep(100);
    if (!fs.existsSync(portFile)) throw new Error("Browser debugging endpoint did not start.");
    const port = fs.readFileSync(portFile, "utf8").split("\n")[0];
    const target = await (await fetch("http://127.0.0.1:" + port + "/json/new", { method: "PUT" })).json();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
    const pending = new Map(); let nextId = 0; const errors = [];
    socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
      if (message.id) {
        const request = pending.get(message.id); pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
      }
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: "http://127.0.0.1:" + server.address().port });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(`document.querySelectorAll("table").length === 3`)) break;
      await sleep(100);
    }
    await evaluate(`window.getTable = caption => [...document.querySelectorAll("table")].find(table => table.caption.textContent === caption);
      window.clickHeader = (caption, name) => { getTable(caption).querySelector('button[aria-label="' + name + ' column options"]').click(); };
      window.selectMenu = label => { const button = [...document.querySelectorAll('[role="menu"] button')].find(button => button.textContent.startsWith(label)); if (!button) throw Error('Missing option '+label); button.click(); };
      window.rowNames = caption => [...getTable(caption).tBodies[0].rows].filter(row => !row.hidden && !row.querySelector('[role="region"]')).map(row => row.textContent);
      window.settle = () => new Promise(resolve => setTimeout(() => requestAnimationFrame(resolve), 250));`);
    await evaluate(`document.querySelector('#toolbar-fixture input').focus()`);
    await send("Input.insertText", { text: " Juan " });
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", windowsVirtualKeyCode: 13 });
    await evaluate(`document.querySelector('#toolbar-fixture form').requestSubmit(); settle()`);
    assert.equal(await evaluate(`document.querySelector('#search-calls').textContent`), "1");
    assert.equal(await evaluate(`window.lastSearch`), "Juan");
    assert.equal(await evaluate(`document.querySelector('#toolbar-fixture button[type=submit]').disabled`), true);
    await evaluate(`window.finishSearch(); settle()`);
    assert.equal(await evaluate(`document.querySelector('#toolbar-fixture button[type=submit]').disabled`), false);
    await evaluate(`document.querySelector('#toolbar-fixture button[aria-label="Clear search"]').click(); settle()`);
    assert.equal(await evaluate(`document.querySelector('#toolbar-fixture input').value`), "");
    await evaluate(`document.querySelector('#toolbar-fixture button[aria-haspopup=dialog]').click(); settle()`);
    assert.equal(await evaluate(`document.querySelectorAll('[role=dialog]').length`), 1);
    await evaluate(`[...document.querySelectorAll("button")].find(button => button.textContent.includes("All Time")).click(); settle()`);
    await evaluate(`[...document.querySelectorAll("button")].find(button => button.textContent.trim() === "This Month").click(); settle()`);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await evaluate(`settle()`);
    assert.equal(await evaluate(`document.querySelector('[role=dialog]') === null`), true);
    assert.equal(await evaluate(`document.activeElement.textContent`), "Quick Filter");
    await evaluate(`document.querySelector('#toolbar-fixture button[aria-haspopup=dialog]').click(); settle()`);
    assert.match(await evaluate(`[...document.querySelectorAll("button")].find(button => button.textContent.includes("This Month")).textContent`), /This Month/);
    await evaluate(`document.querySelector('button[aria-label="Close quick filter"]').click(); settle()`);
    await evaluate(`clickHeader("Freeze without sorting", "Freeze Only"); settle()`);
    assert.equal(await evaluate(`document.querySelectorAll("[role=menu] button").length`), 1);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    assert.equal(await evaluate(`document.querySelector("[role=menu]") === null`), true);
    assert.equal(await evaluate(`document.activeElement.getAttribute("aria-label")`), "Freeze Only column options");
    assert.match(await evaluate(`getTable("Empty table").textContent`), /No records found/);
    assert.equal(await evaluate(`getTable("Loading table").tBodies[0].rows.length`), 5);
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate(`settle()`);
    assert.equal(await evaluate(`document.querySelector('#toolbar-fixture').scrollWidth <= document.querySelector('#toolbar-fixture').clientWidth`), true);
    await evaluate(`scrollTo(0,0); settle()`);
    const mobileScreenshot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(root, "toolbar-mobile.png"), Buffer.from(mobileScreenshot.data, "base64"));
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate(`scrollTo(0, 0); settle()`);
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    fs.writeFileSync(path.join(root, "table-desktop.png"), Buffer.from(screenshot.data, "base64"));
    assert.deepEqual(errors, []);
    console.log("Browser checks passed: toolbar submission/duplicate prevention, existing QuickFilter/focus/persistence, mobile layout, empty and loading tables.");
    console.log("Screenshot: " + path.join(root, "table-desktop.png"));
  } finally {
    socket?.close(); browser.kill(); await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
