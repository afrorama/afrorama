/**
 * Afrorama — course-reminders Edge Function
 *
 * Sends daily lesson reminder emails to users who have opted in
 * and have not completed today's lesson yet.
 *
 * Schedule this via Supabase Dashboard → Edge Functions → Schedule
 * or using pg_cron: SELECT cron.schedule('daily-reminders', '0 7 * * *', ...);
 *
 * Deploy:
 *   supabase functions deploy course-reminders
 *
 * Required secrets:
 *   RESEND_API_KEY   — get from resend.com (free tier covers 3,000 emails/month)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Required Supabase table (add to your schema):
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS course_reminders BOOLEAN DEFAULT false;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reminder_email TEXT;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS enrolled_courses JSONB DEFAULT '[]';
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL     = 'hello@afrorama.org';
const SITE_URL       = 'https://afrorama.org';

const COURSE_NAMES: Record<string, string> = {
  'deep-work':        'Deep Work Fundamentals',
  'time-blocking':    'Time Blocking for Impact Professionals',
  'managing-up':      'Managing Up: Working with Leaders',
  'focus-sprint':     'The Focus Sprint Method',
  'pay-basics':       'Understanding Your Pay & Benefits',
  'personal-finance': 'Personal Finance for the Impact Sector',
  'salary-negotiation':'Salary Negotiation in Africa',
  'investment-basics':'Investment Fundamentals for Changemakers',
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log(`[course-reminders] RESEND_API_KEY not set — would send to ${to}: ${subject}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) console.error('[course-reminders] Email send failed:', await res.text());
}

function reminderEmailHTML(firstName: string, courseName: string, courseId: string): string {
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:Inter,sans-serif;background:#F6F5F2;padding:40px 20px;}
.card{background:#fff;border:2.5px solid #1C1D1C;border-radius:16px;max-width:520px;margin:0 auto;overflow:hidden;box-shadow:5px 5px 0 #1C1D1C;}
.header{background:#3F7E44;padding:28px 32px;text-align:center;}
.header h1{color:#FFE400;font-size:32px;letter-spacing:.04em;text-transform:uppercase;margin:0;font-weight:900;}
.body{padding:28px 32px;}
.streak{display:inline-block;background:#FFE400;border:2px solid #1C1D1C;border-radius:100px;padding:5px 16px;font-weight:800;font-size:14px;margin-bottom:16px;}
.cta{display:block;background:#1C1D1C;color:#FFE400;border:2.5px solid #1C1D1C;border-radius:100px;padding:14px 28px;text-align:center;text-decoration:none;font-weight:700;font-size:16px;box-shadow:3px 3px 0 rgba(0,0,0,.2);margin-top:20px;}
.footer{padding:20px 32px;text-align:center;font-size:12px;color:#888;border-top:1px solid #E0E0DE;}
</style></head>
<body>
<div class="card">
  <div class="header"><h1>🔥 Keep your streak!</h1></div>
  <div class="body">
    <p>Hi ${firstName},</p>
    <div class="streak">📚 Daily learning reminder</div>
    <p>You are making great progress on <strong>${courseName}</strong>. Today's lesson is ready for you — it takes just 5–10 minutes.</p>
    <p>Every day you show up is a day you invest in yourself and in Africa's impact economy.</p>
    <a href="${SITE_URL}/courses.html" class="cta">Continue learning →</a>
  </div>
  <div class="footer">
    You are receiving this because you enabled daily reminders on Afrorama.<br>
    <a href="${SITE_URL}/profile.html" style="color:#FD6925;">Manage your reminder settings</a>
  </div>
</div>
</body></html>`;
}

Deno.serve(async () => {
  // Get all users with course reminders enabled
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, full_name, reminder_email, enrolled_courses')
    .eq('course_reminders', true);

  if (error) {
    console.error('[course-reminders] Failed to fetch users:', error);
    return new Response('Error', { status: 500 });
  }

  let sent = 0;
  for (const user of (users || [])) {
    const email     = user.reminder_email || '';
    if (!email) continue;

    const enrolled  = (user.enrolled_courses as string[]) || [];
    const courseId  = enrolled[0] || 'deep-work'; // Send for first enrolled course
    const courseName= COURSE_NAMES[courseId] || 'your current course';
    const firstName = (user.full_name || 'there').split(' ')[0];

    await sendEmail(
      email,
      `📚 Your daily lesson is ready — ${courseName}`,
      reminderEmailHTML(firstName, courseName, courseId),
    );
    sent++;
  }

  console.log(`[course-reminders] Sent ${sent} reminder emails`);
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
});
