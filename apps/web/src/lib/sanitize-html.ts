import DOMPurify from "dompurify";

/**
 * Tags and attributes the rich-text editor (TipTap StarterKit) can produce.
 * Issue descriptions are stored as HTML and the backend doesn't sanitize them,
 * so anything outside this set didn't come from our editor and is dropped
 * rather than rendered.
 */
const ALLOWED_TAGS = [
	"p",
	"br",
	"strong",
	"b",
	"em",
	"i",
	"s",
	"u",
	"code",
	"pre",
	"blockquote",
	"hr",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"ul",
	"ol",
	"li",
	"a",
];
const ALLOWED_ATTR = ["href", "target", "rel"];

/**
 * Make user-authored HTML safe to hand to `dangerouslySetInnerHTML`. Strips
 * scripts, event-handler attributes and `javascript:` URLs, plus any markup the
 * editor can't produce.
 *
 * DOMPurify needs a DOM. With none (server render) this returns an empty string
 * instead of passing the input through — it fails closed.
 */
export function sanitizeHtml(dirty: string): string {
	if (!DOMPurify.isSupported) return "";
	return DOMPurify.sanitize(dirty, {
		ALLOWED_TAGS,
		ALLOWED_ATTR,
		ALLOW_DATA_ATTR: false,
	});
}
