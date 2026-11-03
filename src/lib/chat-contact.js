export const CHAT_WHATSAPP_TEXT = "Hello Daybytes Tech Solutions, I visited your website and I'd like to make an enquiry.";

export function buildChatWhatsAppUrl(phone = siteContact.phone.e164) {
	const digits = String(phone).replace(/\D/g, '');
	return `https://wa.me/${digits}?text=${encodeURIComponent(CHAT_WHATSAPP_TEXT)}`;
}

export const isUnansweredAssistantReply = (answer) => /\b(?:i (?:do not|don't) know|not (?:in|part of) (?:the )?(?:information|knowledge)|i can't answer|i cannot answer)\b/i.test(answer);