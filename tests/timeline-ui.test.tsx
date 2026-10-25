import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Timeline, TimelineLegend } from "@/components/common/timeline/timeline";
import { formatDateTime } from "@/utils/date";

test("shared timeline renders event titles, Manila dates, actors, notes and resource details", () => {
  const occurredAt = "2026-10-25T01:00:00Z";
  const html = renderToStaticMarkup(<Timeline entries={[
    { id: "created", title: "Request created", occurredAt, actorName: "Creator", tone: "info", icon: <span>Event icon</span> },
    { id: "approved", title: "Request approved", occurredAt, actorName: "Reviewer", tone: "success", note: "Deliver <today>\nThank you", content: <p>Requested quantity: 12.5 L</p> },
  ]} />);
  assert.match(html, /aria-label="Timeline"/);
  assert.ok(html.indexOf("Request created") < html.indexOf("Request approved"));
  assert.ok(html.includes(formatDateTime(occurredAt)));
  assert.match(html, /dateTime="2026-10-25T01:00:00Z"/i);
  for (const text of ["Creator", "Reviewer", "Event icon", "Requested quantity: 12.5 L", "Deliver &lt;today&gt;\nThank you"]) {
    assert.ok(html.includes(text), `Missing timeline content: ${text}`);
  }
  assert.match(html, /text-emerald-700/);
});

test("shared timeline handles empty activity and an unavailable actor without a note", () => {
  assert.match(renderToStaticMarkup(<Timeline entries={[]} />), /No activity yet/);
  const html = renderToStaticMarkup(<Timeline entries={[{ id: "event", title: "Order closed", occurredAt: "2026-10-25T01:00:00Z", actorName: null }]} />);
  assert.match(html, /Unavailable user/);
  assert.match(html, /Order closed/);
  assert.doesNotMatch(html, /whitespace-pre-wrap/);
});

test("timeline legend displays repeated event types once", () => {
  const entry = { id: "first", title: "Draft updated", occurredAt: "2026-10-25T01:00:00Z", actorName: null };
  const html = renderToStaticMarkup(<TimelineLegend entries={[entry, { ...entry, id: "second" }]} />);
  assert.match(html, /aria-label="Event colors"/);
  assert.equal((html.match(/Draft updated/g) ?? []).length, 1);
});
