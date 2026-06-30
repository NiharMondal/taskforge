import { api } from "@/lib/axios";

/**
 * Client-side Cloudinary helpers (see spec/cloudinary.md).
 *
 * Lifecycle: the browser uploads directly into a `temp/` folder via an unsigned
 * preset, then sends `{ avatarUrl, avatarPublicId }` to the backend. On save the
 * backend *promotes* the temp asset to its permanent folder; anything left in a
 * temp folder (replaced, removed, or never saved) is deleted through the backend
 * `delete-temp` endpoint, which holds the Cloudinary API secret.
 */
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET_NAME;

/** The path segment marking an asset as not-yet-saved (mirrors the backend). */
const TEMP_SEGMENT = "/temp/";

export interface CloudinaryUpload {
	/** `secure_url` — sent to the backend as `avatarUrl`. */
	url: string;
	/** `public_id` — sent as `avatarPublicId`; drives promotion / cleanup. */
	publicId: string;
}

/** True when a publicId still lives in a temp folder (i.e. is an orphan if unsaved). */
export function isTempPublicId(publicId?: string | null): boolean {
	return !!publicId && publicId.includes(TEMP_SEGMENT);
}

/**
 * Upload an image to Cloudinary via the unsigned preset, into
 * `taskforge/<folder>` (pass a `temp/...` folder so it can be cleaned up).
 */
export async function uploadToCloudinary(
	file: File,
	folder: string,
): Promise<CloudinaryUpload> {
	if (!CLOUD_NAME || !PRESET_NAME) {
		throw new Error(
			"Cloudinary is not configured — set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_PRESET_NAME.",
		);
	}

	const formData = new FormData();
	formData.append("file", file);
	formData.append("upload_preset", PRESET_NAME);
	formData.append("folder", `taskforge/${folder}`);

	const res = await fetch(
		`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
		{ method: "POST", body: formData },
	);

	const data = await res.json().catch(() => null);
	if (!res.ok) {
		throw new Error(data?.error?.message ?? "Image upload failed");
	}

	return { url: data.secure_url as string, publicId: data.public_id as string };
}

/**
 * Best-effort removal of an unsaved (temp) asset via the backend. The backend
 * owns the API secret and ignores non-temp ids; failures are swallowed since
 * cleanup must never break the surrounding flow.
 */
export async function deleteTempImage(publicId?: string | null): Promise<void> {
	if (!isTempPublicId(publicId)) return;
	try {
		await api.post("/cloudinary/delete-temp", { publicId });
	} catch {
		// ignore — cleanup is best-effort
	}
}
