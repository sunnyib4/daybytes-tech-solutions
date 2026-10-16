import type { APIRoute } from 'astro';
import { env as cloudflareEnv } from 'cloudflare:workers';
import { site } from '@/data/site';

export const prerender = false;

type FormKind = 'contact' | 'training' | 'careers';

type EmailRecipient = {
  email: string;
  name?: string;
};

type BrevoEmailPayload = {
  sender: EmailRecipient;
  to: EmailRecipient[];
  replyTo?: EmailRecipient;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  attachment?: Array<{ content: string; name: string; url?: string; contentType?: string }>;
};

type BrevoEnvironment = Record<string, string | undefined>;

const getSetting = (name: string) => {
  const runtimeValue = typeof cloudflareEnv !== 'undefined' ? (cloudflareEnv as BrevoEnvironment)[name] : undefined;
  const nodeValue = typeof process !== 'undefined' ? process.env[name] : undefined;
  return runtimeValue ?? nodeValue ?? import.meta.env[name] ?? '';
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const toText = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');

const formConfig: Record<
  FormKind,
  {
    subject: string;
    label: string;
    recipientSetting: string;
    autoReplySubject: string;
    autoReplyIntro: string;
    autoReplyCtaLabel: string;
    autoReplyCtaUrl: string;
  }
> = {
  contact: {
    subject: 'New service request: daybytes.com',
    label: 'Service request',
    recipientSetting: 'BREVO_CONTACT_TO',
    autoReplySubject: 'Thanks for contacting Daybytes',
    autoReplyIntro: 'Thanks for reaching out. We have received your request.',
    autoReplyCtaLabel: 'Explore our services',
    autoReplyCtaUrl: `${site.url}/services`,
  },
  training: {
    subject: 'New training application: daybytes.com',
    label: 'Training application',
    recipientSetting: 'BREVO_TRAINING_TO',
    autoReplySubject: 'Your Daybytes training application has been received',
    autoReplyIntro: 'Thanks for your interest in our training programs. We have received your application.',
    autoReplyCtaLabel: 'Explore our programs',
    autoReplyCtaUrl: `${site.url}/training`,
  },
  careers: {
    subject: 'New job application: daybytes.com',
    label: 'Job application',
    recipientSetting: 'BREVO_CAREERS_TO',
    autoReplySubject: 'Thanks for applying to Daybytes',
    autoReplyIntro: 'Thanks for applying. We have received your application.',
    autoReplyCtaLabel: 'Visit Daybytes',
    autoReplyCtaUrl: site.url,
  },
};

async function sendBrevoEmail(payload: BrevoEmailPayload) {
  const apiKey = getSetting('BREVO_API_KEY');
  if (!apiKey) {
    throw new Error('Missing BREVO_API_KEY');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Brevo request failed');
  }
}

function buildAdminRows(formData: FormData) {
  const rows = [
    ['Name', toText(formData.get('name'))],
    ['Email', toText(formData.get('email'))],
    ['Phone', toText(formData.get('phone'))],
    ['Form', formConfig[(formData.get('form_name') as FormKind) || 'contact'].label],
  ];

  const extra = [
    ['Service', toText(formData.get('service'))],
    ['Program', toText(formData.get('program'))],
    ['Role', toText(formData.get('role'))],
    ['Applying as', toText(formData.get('as'))],
    ['Preferred format', toText(formData.get('format'))],
    ['Experience', toText(formData.get('experience'))],
    ['CV link', toText(formData.get('cv_link'))],
    ['Portfolio', toText(formData.get('portfolio'))],
    ['Cover note', toText(formData.get('cover_note'))],
    ['Message', toText(formData.get('message'))],
    ['Notes', toText(formData.get('note'))],
  ];

  return [...rows, ...extra.filter(([, value]) => value)].map(([label, value]) => ({ label, value }));
}

function buildSummaryHtml(formType: FormKind, formData: FormData) {
  const rows = buildAdminRows(formData);
  const body = rows
    .map(({ label, value }) => `<tr><th scope="row" style="width:150px; text-align:left; vertical-align:top; padding:12px 14px; border-bottom:1px solid #e3dfda; font-weight:600; color:#4a433d;">${escapeHtml(label)}</th><td style="padding:12px 14px; border-bottom:1px solid #e3dfda; color:#2e2924;">${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`)
    .join('');

  const content = `
    <p style="margin:0 0 8px; color:#b8480c; font-family:Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:1px;">WEBSITE ENQUIRY</p>
    <h1 style="margin:0 0 10px; color:#1a1714; font-family:Georgia,'Times New Roman',serif; font-size:28px; font-weight:700; line-height:1.25;">New ${escapeHtml(formConfig[formType].label)}</h1>
    <p style="margin:0 0 24px; color:#4a433d; font-family:Arial,sans-serif; font-size:15px; line-height:1.65;">A new form submission is ready for your review.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border:1px solid #e3dfda; border-collapse:collapse; font-family:Arial,sans-serif; font-size:14px; line-height:1.5;">
      ${body}
    </table>
  `;

  return buildEmailLayout(content, `New ${formConfig[formType].label} submitted`);
}

function buildAutoReplyHtml(formType: FormKind, name: string) {
  const config = formConfig[formType];
  const content = `
    <p style="margin:0 0 10px; color:#b8480c; font-family:Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:1px;">MESSAGE RECEIVED</p>
    <h1 style="margin:0 0 16px; color:#1a1714; font-family:Georgia,'Times New Roman',serif; font-size:30px; font-weight:700; line-height:1.25;">Thanks for reaching out, ${escapeHtml(name || 'there')}.</h1>
    <p style="margin:0 0 14px; color:#2e2924; font-family:Arial,sans-serif; font-size:16px; line-height:1.7;">${escapeHtml(config.autoReplyIntro)}</p>
    <p style="margin:0 0 26px; color:#4a433d; font-family:Arial,sans-serif; font-size:15px; line-height:1.7;">We will review your ${escapeHtml(config.label.toLowerCase())} and get back to you as soon as possible.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr><td align="center" bgcolor="#f26a1b" style="border-radius:4px;">
        <a href="${escapeHtml(config.autoReplyCtaUrl)}" style="display:inline-block; padding:14px 20px; border:1px solid #f26a1b; color:#1a1714; font-family:Arial,sans-serif; font-size:14px; font-weight:700; line-height:1.2; text-decoration:none;">${escapeHtml(config.autoReplyCtaLabel)}</a>
      </td></tr>
    </table>
    <p style="margin:28px 0 0; color:#4a433d; font-family:Arial,sans-serif; font-size:14px; line-height:1.6;">Best regards,<br /><strong style="color:#1a1714;">Daybytes Tech Solutions</strong></p>
  `;

  return buildEmailLayout(content, config.autoReplyIntro);
}

function buildEmailLayout(content: string, preheader: string) {
  const logoUrl = `${site.url}/brand/daybytes-logo-512.png`;
  return `
    <div style="margin:0; padding:0; background-color:#f4f3f1;">
      <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(preheader)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f3f1" style="width:100%; border-collapse:collapse; background-color:#f4f3f1;">
        <tr><td align="center" style="padding:28px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%; max-width:600px; border-collapse:collapse; background-color:#ffffff;">
            <tr><td height="4" bgcolor="#f26a1b" style="height:4px; line-height:4px; font-size:0;">&nbsp;</td></tr>
            <tr><td style="padding:20px 28px; border-bottom:1px solid #e3dfda;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td valign="middle" style="padding-right:12px;"><img src="${escapeHtml(logoUrl)}" width="42" height="42" alt="Daybytes mark" style="display:block; width:42px; height:42px; border:0;" /></td>
                  <td valign="middle" style="color:#1a1714; font-family:Arial,sans-serif; font-size:15px; font-weight:700; line-height:1.35;">Daybytes Tech Solutions<br /><span style="color:#5a524b; font-size:10px; font-weight:400; letter-spacing:1px;">SMART TECH FOR BUSINESS</span></td>
                </tr>
              </table>
            </td></tr>
            <tr><td style="padding:30px 28px 34px;">${content}</td></tr>
            <tr><td style="padding:18px 28px 22px; border-top:1px solid #e3dfda; color:#5a524b; font-family:Arial,sans-serif; font-size:12px; line-height:1.7;">
              Daybytes Tech Solutions<br />
              <a href="${site.url}" style="color:#8a3a0c; text-decoration:underline;">daybytes.com</a>
              &nbsp;·&nbsp;
              <a href="mailto:${site.email}" style="color:#8a3a0c; text-decoration:underline;">${site.email}</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </div>
  `;
}

export const POST: APIRoute = async ({ params, request }) => {
  const formType = (params?.form as FormKind | undefined) || 'contact';
  if (!['contact', 'training', 'careers'].includes(formType)) {
    return new Response(JSON.stringify({ error: 'Invalid form type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const formData = await request.formData();
  const name = toText(formData.get('name')) || toText(formData.get('t-name')) || 'Website enquiry';
  const email = toText(formData.get('email')) || toText(formData.get('t-email'));
  const cvFile = formData.get('cv');
  const adminRecipient = getSetting(formConfig[formType].recipientSetting) || site.email;
  const senderEmail = getSetting('BREVO_SENDER_EMAIL') || site.email;
  const senderName = 'Daybytes Tech Solutions';

  try {
    const attachments = [] as Array<{ content: string; name: string; contentType: string }>;
    if (cvFile instanceof File && cvFile.size > 0) {
      const bytes = new Uint8Array(await cvFile.arrayBuffer());
      attachments.push({
        content: toBase64(bytes),
        name: cvFile.name,
        contentType: cvFile.type || 'application/octet-stream',
      });
    }

    const adminPayload: BrevoEmailPayload = {
      sender: { email: senderEmail, name: senderName },
      to: [{ email: adminRecipient, name: 'Daybytes admin' }],
      subject: formConfig[formType].subject,
      htmlContent: buildSummaryHtml(formType, formData),
      textContent: buildAdminRows(formData).map(({ label, value }) => `${label}: ${value}`).join('\n'),
      attachment: attachments.length ? attachments : undefined,
    };

    await sendBrevoEmail(adminPayload);

    if (email) {
      const autoReplyPayload: BrevoEmailPayload = {
        sender: { email: senderEmail, name: senderName },
        to: [{ email, name }],
        replyTo: { email: site.email, name: 'Daybytes Tech Solutions' },
        subject: formConfig[formType].autoReplySubject,
        htmlContent: buildAutoReplyHtml(formType, name),
        textContent: `${formConfig[formType].autoReplyIntro}\n\nWe will get back to you as soon as possible.\n\nBest regards,\nDaybytes Tech Solutions`,
      };

      await sendBrevoEmail(autoReplyPayload);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Brevo submission failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
