// Supabase Edge Function: send-breakdown
//
// Triggered by a database trigger the moment a row is inserted into
// public.signups (see supabase/trigger.sql). Sends the visitor a
// personalized breakdown email via Resend, using the dominant_dimension
// and scores already saved on the row.
//
// Required secrets (set via `supabase secrets set`):
//   RESEND_API_KEY        - from resend.com/api-keys
//   SIGNUP_WEBHOOK_SECRET  - shared secret checked against the trigger's
//                            request, so this function can't be spammed
//                            by anyone who finds its URL
//   SENDER_EMAIL           - verified sender, e.g. hello@theimmigrantoperator.com

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("SIGNUP_WEBHOOK_SECRET")!;
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") ?? "onboarding@resend.dev";

type Dimension = {
  key: string;
  name: string;
  chapter: string;
  blurb: string;
};

const DIMENSIONS: Dimension[] = [
  {
    key: "soc",
    name: "Social",
    chapter: 'Chapter 1: "The Weight of Starting Over"',
    blurb:
      "The Social tax shows up as rebuilding trust, community, and belonging from scratch, often more than once. Chapter 1 walks through why that weight is invisible to everyone around you, and how to stop treating it as a personal failure.",
  },
  {
    key: "fin",
    name: "Financial",
    chapter: 'Chapter 10: "From Labor to Leverage"',
    blurb:
      "The Financial tax is the cost of restarting your net worth while often supporting people beyond yourself. Chapter 10 is where the book turns this from a treadmill into a system that compounds.",
  },
  {
    key: "pro",
    name: "Professional",
    chapter: 'Chapter 4: "The Identity Crisis Nobody Talks About"',
    blurb:
      "The Professional tax is having your experience discounted and having to re-prove competence that should already be established. Chapter 4 names this before Part II shows you how to rebuild authority on your own terms.",
  },
  {
    key: "cul",
    name: "Cultural",
    chapter: 'Introduction: "The Invisible Weight"',
    blurb:
      "The Cultural tax is the constant translation: code-switching between the playbook you grew up with and the one the room expects. The Introduction names this directly so you can stop carrying it silently.",
  },
  {
    key: "psy",
    name: "Psychological",
    chapter: 'Chapter 2: "The Survival Trap"',
    blurb:
      "The Psychological tax is a nervous system still braced for a crisis that isn't there anymore. Chapter 2 is the book's argument for why the habits that once saved you are now the ones holding you back.",
  },
];

function levelOf(score: number): string {
  if (score <= 7) return "Low";
  if (score <= 11) return "Moderate";
  return "High";
}

function renderEmail(email: string, dominantKey: string, scores: Record<string, number>) {
  const dominant = DIMENSIONS.find((d) => d.key === dominantKey) ?? DIMENSIONS[0];
  const rows = DIMENSIONS.map((d) => {
    const score = scores?.[d.key] ?? 0;
    return `<tr><td style="padding:6px 12px 6px 0;color:#5B6570;">${d.name}</td><td style="padding:6px 0;font-variant-numeric:tabular-nums;">${score} / 15 (${levelOf(score)})</td></tr>`;
  }).join("");

  const html = `
  <div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;color:#1C2530;">
    <p style="font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#9C6D24;margin:0 0 12px;">Your Restart Penalty Breakdown</p>
    <h1 style="font-size:22px;font-weight:400;margin:0 0 16px;">Your dominant tax: ${dominant.name}</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">${dominant.blurb}</p>
    <p style="font-size:14px;font-style:italic;color:#5B6570;margin:0 0 28px;">${dominant.chapter}</p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px;">${rows}</table>

    <hr style="border:none;border-top:1px solid #D3CDBC;margin:0 0 24px;">

    <p style="font-size:15px;line-height:1.6;margin:0 0 12px;"><strong>THE IMMIGRANT OPERATOR</strong><br>Turning Survival Into Systems, Discipline Into Leverage, and Work Into Legacy</p>
    <p style="font-size:14px;line-height:1.6;color:#5B6570;margin:0 0 24px;">Survival was never meant to be your destination. It was always meant to be your starting point. The book is currently in editing, with no release date locked yet, you'll be the first to know when that changes.</p>

    <p style="font-size:14px;line-height:1.6;">
      <a href="https://theimmigrantoperator.com" style="color:#33475A;">theimmigrantoperator.com</a>
    </p>
  </div>`.trim();

  const text = `Your dominant tax: ${dominant.name}

${dominant.blurb}
(${dominant.chapter})

Your scores:
${DIMENSIONS.map((d) => `${d.name}: ${scores?.[d.key] ?? 0} / 15 (${levelOf(scores?.[d.key] ?? 0)})`).join("\n")}

THE IMMIGRANT OPERATOR
Turning Survival Into Systems, Discipline Into Leverage, and Work Into Legacy

Survival was never meant to be your destination. It was always meant to be your starting point.
The book is currently in editing, with no release date locked yet, you'll be the first to know when that changes.

https://theimmigrantoperator.com`;

  return { html, text, subject: `Your Restart Penalty breakdown: ${dominant.name}` };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const row = payload.record ?? payload;
  const email: string | undefined = row?.email;
  const dominantKey: string = row?.dominant_dimension ?? "soc";
  const scores: Record<string, number> = row?.scores ?? {};

  if (!email) {
    return new Response("Missing email", { status: 400 });
  }

  const { html, text, subject } = renderEmail(email, dominantKey, scores);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: SENDER_EMAIL,
      to: [email],
      subject,
      html,
      text,
    }),
  });

  if (!resendRes.ok) {
    const errBody = await resendRes.text();
    console.error("Resend error:", resendRes.status, errBody);
    return new Response(`Resend error: ${errBody}`, { status: 502 });
  }

  return new Response("sent", { status: 200 });
});
