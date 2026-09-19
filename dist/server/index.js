const emptyRecord = () => ({ version: 2, checked: {}, rewards: { claimed: {}, custom: {}, locked: {} }, notes: {}, weekly: {}, measurements: [] });
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
});
const object = value => value && typeof value === "object" && !Array.isArray(value);
function validRecord(record) {
  if (!object(record) || record.version !== 2 || !object(record.checked) || !object(record.rewards) ||
      !object(record.rewards.claimed) || !object(record.rewards.custom) || !object(record.rewards.locked) ||
      !object(record.notes) || !object(record.weekly) || !Array.isArray(record.measurements)) return false;
  const phase = "(?:launchpad|cardio|circuit|gladiator-[0-5]|byow-[0-7])";
  const task = new RegExp("^" + phase + "-\\d{1,2}-[01]$");
  const week = new RegExp("^" + phase + "-\\d{1,2}$");
  const reward = /^(?:genai|planning|cardio|circuit|week10|block[0-5])$/;
  const block = /^block[0-5]$/;
  const entries = Object.entries;
  if (entries(record.checked).length > 1000 || !entries(record.checked).every(([k,v]) => task.test(k) && v === true)) return false;
  if (entries(record.notes).length > 80 || !entries(record.notes).every(([k,v]) => week.test(k) && typeof v === "string" && v.length <= 1200)) return false;
  if (entries(record.rewards.claimed).length > 11 || !entries(record.rewards.claimed).every(([k,v]) => reward.test(k) && v === true)) return false;
  if (entries(record.rewards.custom).length > 6 || !entries(record.rewards.custom).every(([k,v]) => block.test(k) && typeof v === "string" && v.length <= 300)) return false;
  if (entries(record.rewards.locked).length > 6 || !entries(record.rewards.locked).every(([k,v]) => block.test(k) && v === true && !!record.rewards.custom[k]?.trim())) return false;
  if (entries(record.weekly).length > 80 || !entries(record.weekly).every(([k,v]) => week.test(k) && object(v) &&
      (v.weight === null || (typeof v.weight === "number" && v.weight >= 30 && v.weight <= 300)) &&
      (v.bodyFat === null || (typeof v.bodyFat === "number" && v.bodyFat >= 3 && v.bodyFat <= 70)))) return false;
  const fields = new Set(["chest","shoulders","waistBelly","waistHandles","hips","bicepsRight","bicepsLeft","forearmRight","forearmLeft","thigh","calves","neck","weight","bodyFat"]);
  if (record.measurements.length > 200) return false;
  return record.measurements.every(row => object(row) && /^\\d{4}-\\d{2}-\\d{2}$/.test(row.date) &&
    entries(row).every(([k,v]) => k === "date" || (fields.has(k) && typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 300)));
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/progress") {
      const userId = request.headers.get("oai-authenticated-user-id");
      if (!userId) return json({ error: "Sign in to save progress across devices." }, 401);
      if (!env.DB) return json({ error: "Progress storage is unavailable." }, 503);
      try {
        if (request.method === "GET") {
          const row = await env.DB.prepare("SELECT record FROM user_progress WHERE user_id = ?").bind(userId).first();
          return json({ record: row ? JSON.parse(row.record) : emptyRecord(), hasSavedRecord: !!row });
        }
        if (request.method === "PUT") {
          const body = await request.text();
          if (body.length > 150000) return json({ error: "Progress record is too large." }, 413);
          let record;
          try { record = JSON.parse(body); } catch { return json({ error: "Invalid progress record." }, 400); }
          if (!validRecord(record)) return json({ error: "Invalid progress record." }, 400);
          await env.DB.prepare("INSERT INTO user_progress (user_id, record, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET record = excluded.record, updated_at = excluded.updated_at")
            .bind(userId, body, new Date().toISOString()).run();
          return json({ ok: true });
        }
        return json({ error: "Method not allowed." }, 405);
      } catch (error) {
        console.error("Progress storage error", error);
        return json({ error: "Progress storage is temporarily unavailable." }, 503);
      }
    }
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    if (url.pathname === "/" || /^\\/(?:foundation|body-stats|general-fitness|fat-loss|strength-size|rounds-of-fury|juggernaut|unit|byow-[1-8])\\/?$/.test(url.pathname)) {
      return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
    }
    return env.ASSETS.fetch(request);
  },
};
