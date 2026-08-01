import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Row = Record<string, unknown>;

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

function windowStart(frequency: string): string {
  const days = frequency === 'daily' ? 1 : frequency === 'monthly' ? 30 : 7;
  return new Date(Date.now() - days * 86400000).toISOString();
}

function nextRun(frequency: string): string {
  const days = frequency === 'daily' ? 1 : frequency === 'monthly' ? 30 : 7;
  return new Date(Date.now() + days * 86400000).toISOString();
}

async function buildReport(admin: any, reportKey: string, since: string): Promise<Row[]> {
  switch (reportKey) {
    case 'transactions': {
      const { data } = await admin
        .from('transactions')
        .select('short_id, type, amount, fee, commission, status, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      return data ?? [];
    }
    case 'revenue_summary': {
      const { data } = await admin
        .from('transactions')
        .select('type, amount, fee, commission, status')
        .gte('created_at', since)
        .eq('status', 'completed')
        .limit(20000);
      const map = new Map<string, { type: string; count: number; volume: number; fees: number; commission: number }>();
      for (const t of data ?? []) {
        const row = map.get(t.type) ?? { type: t.type, count: 0, volume: 0, fees: 0, commission: 0 };
        row.count += 1;
        row.volume += Number(t.amount ?? 0);
        row.fees += Number(t.fee ?? 0);
        row.commission += Number(t.commission ?? 0);
        map.set(t.type, row);
      }
      return [...map.values()];
    }
    case 'new_users': {
      const { data } = await admin
        .from('profiles')
        .select('name, phone, status, balance, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      return data ?? [];
    }
    case 'kyc_queue': {
      const { data } = await admin
        .from('kyc_verifications')
        .select('user_id, status, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(5000);
      return data ?? [];
    }
    case 'settlements': {
      const { data } = await admin
        .from('settlements')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      return data ?? [];
    }
    default:
      return [];
  }
}

async function emailCsv(recipients: string[], subject: string, csv: string, rowCount: number): Promise<boolean> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!lovableKey || !resendKey) return false;
  const preview = csv.split('\n').slice(0, 30).join('\n');
  const res = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': resendKey,
    },
    body: JSON.stringify({
      from: 'EasyPay Reports <onboarding@resend.dev>',
      to: recipients,
      subject,
      html: `<p>${rowCount} rows.</p><pre style="font-size:12px">${preview.replace(/</g, '&lt;')}</pre>`,
    }),
  });
  if (!res.ok) {
    console.error(`Email send failed [${res.status}]: ${await res.text()}`);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    let reportId: string | null = null;
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      reportId = typeof body.report_id === 'string' ? body.report_id : null;
    }

    // Manual "Run now" must come from a signed-in admin.
    if (reportId) {
      const token = req.headers.get('Authorization')?.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: userData } = await admin.auth.getUser(token);
      const uid = userData?.user?.id;
      if (!uid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: isAdmin } = await admin.rpc('has_role', { _user_id: uid, _role: 'admin' });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let query = admin.from('admin_scheduled_reports').select('*').eq('is_active', true);
    if (reportId) query = admin.from('admin_scheduled_reports').select('*').eq('id', reportId);
    else query = query.lte('next_run_at', new Date().toISOString());

    const { data: reports, error } = await query;
    if (error) throw error;

    const results: Row[] = [];
    for (const report of reports ?? []) {
      let status = 'generated';
      let errorMessage: string | null = null;
      let csv = '';
      let rowCount = 0;
      let emailed = false;
      try {
        const rows = await buildReport(admin, report.report_key, windowStart(report.frequency));
        rowCount = rows.length;
        csv = toCsv(rows);
        emailed = await emailCsv(
          report.recipients ?? [],
          `${report.label || report.report_key} — ${report.frequency} report`,
          csv,
          rowCount,
        );
        status = emailed ? 'sent' : 'generated';
      } catch (e) {
        status = 'failed';
        errorMessage = e instanceof Error ? e.message : String(e);
      }

      await admin.from('admin_scheduled_report_runs').insert({
        report_id: report.id,
        status,
        row_count: rowCount,
        csv_content: csv.slice(0, 500000) || null,
        error_message: errorMessage,
        sent_at: emailed ? new Date().toISOString() : null,
      });

      await admin
        .from('admin_scheduled_reports')
        .update({ last_run_at: new Date().toISOString(), next_run_at: nextRun(report.frequency) })
        .eq('id', report.id);

      results.push({ report_id: report.id, status, row_count: rowCount, emailed });
    }

    const first = results[0] ?? {};
    return new Response(JSON.stringify({ processed: results.length, ...first, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('admin-scheduled-reports error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
