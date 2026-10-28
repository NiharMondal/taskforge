"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { Button, Label, Spinner, toast } from "@heroui/react";

import Avatar from "@/components/ui/avatar";
import { deleteTempImage, uploadToCloudinary } from "@/lib/cloudinary";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

type Props = {
	/** Form field holding the Cloudinary secure_url (e.g. "avatarUrl"). */
	urlName: string;
	/** Form field holding the Cloudinary public_id (e.g. "avatarPublicId"). */
	publicIdName: string;
	/** Cloudinary folder under `taskforge/` — must be a temp folder so unsaved
	 *  uploads can be cleaned up. */
	folder: string;
	label?: string;
	/** Initials shown when there is no image. */
	fallback?: string;
};

/**
 * RHF-wrapped avatar/image picker (see spec/cloudinary.md). The two field values
 * are the Cloudinary `url` + `public_id`, so it composes with the rest of the
 * form like any other input.
 *
 * Uploads go straight into a `temp/` folder for an instant preview. An asset is
 * an orphan exactly while its publicId is still under `temp/` (on save the
 * backend promotes it to a permanent id). Orphans are removed via the backend
 * on replace, on Remove, and on unmount (navigating away unsaved) — including
 * an upload that only finishes after the form is gone.
 */
export default function FormImageUpload({
	urlName,
	publicIdName,
	folder,
	label,
	fallback,
}: Props) {
	const {
		control,
		getValues,
		setValue,
		formState: { errors },
	} = useFormContext();
	const inputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);

	const url = useWatch({ control, name: urlName }) as string | undefined;
	const publicId = useWatch({ control, name: publicIdName }) as
		| string
		| undefined;

	// Keep the latest publicId for the unmount cleanup (effect closure is stale).
	const publicIdRef = useRef(publicId);
	useEffect(() => {
		publicIdRef.current = publicId;
	}, [publicId]);

	const isMountedRef = useRef(true);
	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
			void deleteTempImage(publicIdRef.current);
		};
	}, []);

	const setBoth = (nextUrl: string, nextPublicId: string) => {
		setValue(urlName, nextUrl, { shouldDirty: true, shouldValidate: true });
		setValue(publicIdName, nextPublicId, { shouldDirty: true });
	};

	const handleUpload = async (file: File) => {
		setIsUploading(true);
		try {
			// Replace any previous unsaved upload before adding a new one.
			await deleteTempImage(getValues(publicIdName));
			const uploaded = await uploadToCloudinary(file, folder);
			// Unmounted mid-upload: the unmount cleanup ran before this id
			// existed, so nothing else will ever delete it.
			if (!isMountedRef.current) {
				void deleteTempImage(uploaded.publicId);
				return;
			}
			setBoth(uploaded.url, uploaded.publicId);
		} catch (error) {
			if (!isMountedRef.current) return;
			setBoth("", "");
			toast.danger(
				error instanceof Error ? error.message : "Image upload failed",
			);
		} finally {
			if (isMountedRef.current) setIsUploading(false);
		}
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = ""; // allow re-picking the same file
		if (!file) return;
		if (!ACCEPTED.includes(file.type)) {
			toast.danger("Choose a PNG, JPG, WEBP or GIF image.");
			return;
		}
		if (file.size > MAX_BYTES) {
			toast.danger("Image is too big. Maximum size is 2MB.");
			return;
		}
		void handleUpload(file);
	};

	const handleRemove = async () => {
		await deleteTempImage(getValues(publicIdName));
		setBoth("", "");
	};

	return (
		<div className="flex flex-col gap-2">
			{label && <Label>{label}</Label>}

			<div className="flex items-center gap-4">
				<Avatar
					src={url || undefined}
					fallback={fallback}
					alt="Profile photo"
					size="lg"
				/>

				<input
					ref={inputRef}
					type="file"
					accept={ACCEPTED.join(",")}
					onChange={handleFileChange}
					className="hidden"
				/>

				<div className="flex gap-2">
					<Button
						type="button"
						variant="outline"
						isDisabled={isUploading}
						onClick={() => inputRef.current?.click()}
					>
						{isUploading ? (
							<span className="flex items-center gap-2">
								<Spinner size="sm" /> Uploading…
							</span>
						) : url ? (
							"Change photo"
						) : (
							"Upload photo"
						)}
					</Button>

					{url && !isUploading && (
						<Button
							type="button"
							variant="ghost"
							onClick={handleRemove}
						>
							Remove
						</Button>
					)}
				</div>
			</div>

			{errors[urlName] && (
				<p className="text-xs text-danger">
					{errors[urlName]?.message as string}
				</p>
			)}
		</div>
	);
}
