// Journey diagnostic script v5 — read-only, service role
// ─────────────────────────────────────────────────────────────────
// Fixes from v4 bug:
//   - profiles has NO `email` column. All emails come from auth.users
//     via admin.getUserById(). No more `select('id, email, ...')` from
//     profiles.
//   - Every Supabase call is wrapped in safeFrom() which checks `error`
//     and logs it explicitly. Never treats null as "missing record"
//     without first verifying error === null.
//
// Coverage for the 12 paying users:
//   - email (auth.users, masked)
//   - profile gates: first_session_completed_at, role, lang, paused_at
//   - journey_user_priorities: ranking[], source, updated_at
//   - journey_item_responses: count total + by item kind (content/assessment)
//   - journey_assignments: count by source_kind
//   - journey_scheduled_items: count + by source + how many unlocked
//   - Summary table at the end
//
// SAFETY: 100% read-only. .select() only. No insert/update/delete/upsert/rpc.

const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing env'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const mask = (e) => { if (!e) return null; const [u, d] = e.split('@'); return (u ? u[0] : '?') + '***@' + (d || '?'); };
const shortId = (id) => id ? id.slice(0, 8) : 'null';

// safeFrom — every query goes through this. Logs error explicitly.
async function safeFrom(label, fn) {
  try {
    const result = await fn();
    if (result.error) {
      console.error(`  [${label}] QUERY FAILED: ${result.error.code || ''} ${result.error.message}`);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  } catch (e) {
    console.error(`  [${label}] THREW: ${e.message}`);
    return { data: null, error: e };
  }
}

async function safe(label, fn) {
  console.log(`\n========== ${label} ==========`);
  try { await fn(); } catch (e) { console.error(`[${label}] CRASH:`, e.message); }
}

// Format ASCII table
function formatTable(rows, columns) {
  if (rows.length === 0) return '(no rows)';
  const widths = columns.map(c => Math.max(c.length, ...rows.map(r => String(r[c] ?? '—').length)));
  const fmtRow = (vals) => vals.map((v, i) => String(v).padEnd(widths[i])).join(' │ ');
  const sep = widths.map(w => '─'.repeat(w)).join('─┼─');
  return [
    fmtRow(columns),
    sep,
    ...rows.map(r => fmtRow(columns.map(c => r[c] ?? '—'))),
  ].join('\n');
}

async function main() {
  console.log('=== NOW (UTC):', new Date().toISOString());
  console.log('=== Israel:   ', new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));

  // Probe schemas first — so we know what columns are safe to query
  console.log('\n========== PROBE: target table columns ==========');
  for (const tbl of ['profiles', 'journey_user_priorities', 'journey_item_responses', 'journey_assignments', 'journey_scheduled_items']) {
    const { data, error } = await safeFrom(`${tbl} probe`, () => sb.from(tbl).select('*').limit(1));
    if (error) continue;
    if (!data || data.length === 0) {
      console.log(`  ${tbl}: empty table`);
      continue;
    }
    console.log(`  ${tbl} columns: ${Object.keys(data[0]).join(', ')}`);
  }

  // ═════════════════════════════════════════════════════════════
  // Find ALL active journey subscribers
  // ═════════════════════════════════════════════════════════════
  console.log('\n========== Loading all active journey subscribers ==========');
  const { data: subs, error: subsErr } = await safeFrom('subscriptions', () =>
    sb.from('subscriptions')
      .select('user_id, current_period_end, created_at, plan, plan_amount, currency')
      .eq('product', 'journey').eq('status', 'active')
      .order('created_at', { ascending: false }).limit(50)
  );
  if (subsErr || !subs) { console.error('  cannot continue without subs list'); process.exit(1); }
  console.log(`Found ${subs.length} active journey subscribers`);

  // Collect per-user data for the summary table
  const summary = [];

  // ═════════════════════════════════════════════════════════════
  // Per-user analysis
  // ═════════════════════════════════════════════════════════════
  for (let idx = 0; idx < subs.length; idx++) {
    const s = subs[idx];
    const uid = s.user_id;
    console.log(`\n────────── User ${idx + 1}/${subs.length}: ${shortId(uid)} ──────────`);
    console.log(`  paid:   ${s.created_at}  plan=${s.plan}  amount=${s.plan_amount}${s.currency}`);

    const row = {
      user_id: shortId(uid),
      email: '?',
      first_session: '?',
      role: '?',
      priorities: '?',
      responses: '?',
      assignments: '?',
      scheduled: '?',
      unlocked: '?',
    };

    // A. auth.users → email
    try {
      const { data: u, error } = await sb.auth.admin.getUserById(uid);
      if (error) {
        console.error(`  [auth.users] ${error.message}`);
        row.email = 'auth_error';
      } else if (!u || !u.user) {
        console.log(`  ⚠️  auth.users: MISSING (sub points to phantom user)`);
        row.email = 'PHANTOM';
      } else {
        row.email = mask(u.user.email);
        console.log(`  auth.users: ${row.email}  created=${u.user.created_at}`);
      }
    } catch (e) {
      console.error(`  [auth.users] threw: ${e.message}`);
    }

    // B. profiles (NO email column!) — only existing fields
    const { data: prof, error: profErr } = await safeFrom('profiles', () =>
      sb.from('profiles')
        .select('id, full_name, role, preferred_language, journey_first_session_completed_at, journey_paused_at')
        .eq('id', uid).maybeSingle()
    );
    if (profErr) {
      row.first_session = 'query_err';
      row.role = 'query_err';
    } else if (!prof) {
      console.log(`  ❌ profiles row genuinely MISSING (error checked, data is null)`);
      row.first_session = 'NO_PROFILE';
      row.role = 'NO_PROFILE';
    } else {
      const fs_state = prof.journey_first_session_completed_at ? `✅ ${prof.journey_first_session_completed_at}` : `❌ NULL`;
      console.log(`  profile: name="${prof.full_name || '—'}"  role=${prof.role}  lang=${prof.preferred_language}`);
      console.log(`     first_session: ${fs_state}`);
      console.log(`     paused_at:     ${prof.journey_paused_at || 'NULL'}`);
      row.first_session = prof.journey_first_session_completed_at ? '✅' : '❌';
      row.role = prof.role;
    }

    // C. journey_user_priorities — use select('*') since columns are
    //    minimal (user_id, ranking, weights, source) and no timestamps
    const { data: prio, error: prioErr } = await safeFrom('journey_user_priorities', () =>
      sb.from('journey_user_priorities')
        .select('*')
        .eq('user_id', uid).maybeSingle()
    );
    if (prioErr) {
      row.priorities = 'query_err';
    } else if (!prio) {
      console.log(`  priorities: ❌ NO ROW (cron will skip this user — "no_priorities")`);
      row.priorities = '❌ none';
    } else {
      console.log(`  priorities: ✅ ranking=[${(prio.ranking || []).map(shortId).join(', ')}]  source=${prio.source}`);
      console.log(`     weights: ${JSON.stringify(prio.weights)}`);
      row.priorities = `${(prio.ranking || []).length} (${prio.source})`;
    }

    // D. journey_item_responses — count + breakdown by item kind
    const { data: respCount, error: respErr } = await safeFrom('item_responses count', () =>
      sb.from('journey_item_responses').select('id', { count: 'exact', head: true }).eq('user_id', uid)
    );
    // .count comes back on the response object, not data
    const { count: respTotal, error: respTotalErr } = await sb.from('journey_item_responses')
      .select('*', { count: 'exact', head: true }).eq('user_id', uid);
    if (respTotalErr) {
      console.error(`  [responses count] ${respTotalErr.message}`);
      row.responses = 'query_err';
    } else {
      row.responses = String(respTotal || 0);
      // Breakdown by item kind
      if (respTotal && respTotal > 0) {
        const { data: respRows, error: rErr } = await safeFrom('responses join', () =>
          sb.from('journey_item_responses')
            .select('id, scheduled_item_id, structured_answer, journey_scheduled_items(item_id, journey_items(kind, title_he))')
            .eq('user_id', uid).limit(50)
        );
        if (rErr) {
          console.log(`  responses: ${respTotal} total (kind breakdown failed)`);
        } else {
          const byKind = {};
          let withSchedule = 0;
          for (const r of (respRows || [])) {
            withSchedule++;
            const k = r.journey_scheduled_items?.journey_items?.kind || 'unknown';
            byKind[k] = (byKind[k] || 0) + 1;
          }
          console.log(`  responses: ${respTotal} total  (sampled ${withSchedule}: by_kind=${JSON.stringify(byKind)})`);
        }
      } else {
        console.log(`  responses: 0 total`);
      }
    }

    // E. journey_assignments — schema confirmed via probe: only user_id
    //    column (no owner_user_id). May also be linked via couple_id.
    const { data: asgs, error: asgErr } = await safeFrom('assignments user_id', () =>
      sb.from('journey_assignments')
        .select('id, source_kind, anchor_date, is_active, created_at, user_id, couple_id, anchor_kind, source_id, origin')
        .eq('user_id', uid)
    );
    if (asgErr) {
      row.assignments = 'query_err';
    } else {
      const list = asgs || [];
      const byKind = {};
      for (const a of list) byKind[`${a.source_kind}${a.is_active ? '' : '/i'}`] = (byKind[`${a.source_kind}${a.is_active ? '' : '/i'}`] || 0) + 1;
      console.log(`  assignments: ${list.length}  by_kind=${JSON.stringify(byKind)}`);
      for (const a of list) {
        console.log(`     └─ ${shortId(a.id)}  kind=${a.source_kind}  active=${a.is_active}  anchor=${a.anchor_date}  user_id=${shortId(a.user_id) || '—'}  couple=${shortId(a.couple_id) || '—'}  origin=${a.origin || '—'}`);
      }
      row.assignments = `${list.length} (${Object.entries(byKind).map(([k, v]) => `${k}:${v}`).join(',')})`;

      // F. scheduled_items for those assignments
      if (list.length > 0) {
        const asgIds = list.map(a => a.id);
        const { data: scheds, error: sErr } = await safeFrom('scheduled_items', () =>
          sb.from('journey_scheduled_items')
            .select('id, unlock_at, notified_at, source, has_unlock_override')
            .in('assignment_id', asgIds)
        );
        if (sErr) {
          row.scheduled = 'query_err';
        } else {
          const all = scheds || [];
          const nowD = Date.now();
          const unlocked = all.filter(r => r.unlock_at && new Date(r.unlock_at).getTime() <= nowD).length;
          const locked = all.filter(r => r.unlock_at && new Date(r.unlock_at).getTime() > nowD).length;
          const bySource = {};
          for (const r of all) bySource[r.source || 'null'] = (bySource[r.source || 'null'] || 0) + 1;
          console.log(`  scheduled_items: total=${all.length}  unlocked=${unlocked}  locked=${locked}  by_source=${JSON.stringify(bySource)}`);
          row.scheduled = String(all.length);
          row.unlocked = String(unlocked);
        }
      } else {
        row.scheduled = '0';
        row.unlocked = '0';
      }
    }

    summary.push(row);
  }

  // ═════════════════════════════════════════════════════════════
  // SUMMARY TABLE
  // ═════════════════════════════════════════════════════════════
  console.log('\n\n══════════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY TABLE — all active journey subscribers');
  console.log('══════════════════════════════════════════════════════════════════════\n');
  console.log(formatTable(summary, [
    'user_id', 'email', 'first_session', 'role', 'priorities', 'responses', 'assignments', 'scheduled', 'unlocked'
  ]));

  // Correlation analysis
  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log('  CORRELATIONS');
  console.log('══════════════════════════════════════════════════════════════════════');
  const total = summary.length;
  const withFirstSession = summary.filter(r => r.first_session === '✅').length;
  const withPriorities = summary.filter(r => !['❌ none', 'query_err', '?'].includes(r.priorities)).length;
  const withResponses = summary.filter(r => Number(r.responses) > 0).length;
  const withAssignments = summary.filter(r => /^[1-9]/.test(r.assignments)).length;
  const withScheduled = summary.filter(r => Number(r.scheduled) > 0).length;

  console.log(`  Total subscribers:       ${total}`);
  console.log(`  Completed first_session: ${withFirstSession}/${total}`);
  console.log(`  Has priority ranking:    ${withPriorities}/${total}`);
  console.log(`  Has any responses:       ${withResponses}/${total}`);
  console.log(`  Has any assignment:      ${withAssignments}/${total}`);
  console.log(`  Has scheduled items:     ${withScheduled}/${total}`);

  // Cross-tab: priorities vs first_session
  const both = summary.filter(r => r.first_session === '✅' && !['❌ none', 'query_err', '?'].includes(r.priorities)).length;
  const fsOnly = summary.filter(r => r.first_session === '✅' && ['❌ none', '?'].includes(r.priorities)).length;
  const prOnly = summary.filter(r => r.first_session !== '✅' && !['❌ none', 'query_err', '?'].includes(r.priorities)).length;
  const neither = summary.filter(r => r.first_session !== '✅' && ['❌ none', '?'].includes(r.priorities)).length;
  console.log(`\n  Cross-tab (first_session × priorities):`);
  console.log(`     both ✅:           ${both}`);
  console.log(`     first_session only: ${fsOnly}`);
  console.log(`     priorities only:    ${prOnly}`);
  console.log(`     neither:            ${neither}`);

  console.log('\n=== DONE ===');
}

main().then(() => process.exit(0)).catch(e => { console.error('FATAL:', e); process.exit(1); });
