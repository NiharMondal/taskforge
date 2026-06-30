### Overview
Here is the demo but production grade code I have used in my previous workflow. Implement this flow in this project. NOTE: CUSTOMISE MAIN COMPONENT ACCORDING TO OUR NEED, FORM AND REACT-HOOK-FORM. and follow the existing design that you made, but functionality should be this

##### Upload function

```javascript
export const uploadToCloudinary = async (file: File, folder: string) => {
	const formData = new FormData();
	formData.append("file", file);
	formData.append(
        "upload_preset",
        `${process.env.NEXT_PUBLIC_CLOUDINARY_PRESET_NAME}`,
    );
	formData.append("folder", `taskforge/${folder}`);

	const res = await fetch(
		`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
		{
			method: "POST",
			body: formData,
		},
	);

	const data = await res.json();
	return {
		url: data.secure_url,
		publicId: data.public_id,
	};
};
```

Delete Temp Image

```javascript
import { envConfig } from "@/config/env-config";

export const deleteTempImage = async (currentPublicId: string) => {
    try {
        await fetch(`${envConfig.backend_url}/cloudinary/delete-temp`, {
            method: "POST",
            body: JSON.stringify({ publicId: currentPublicId }),
            headers: {
                "Content-Type": "application/json",
            },
        });
    } catch (error) {
        console.log(error);
    }
};
```

Using reusable component

```javascript
<TDImageUploadField
	form={form}
	folderName="temp/avatar"
	urlName={`avatar.url`}
	publicIdName={`avatar.publicId`}
/>
```

Main component

```javascript
"use client";

import { CloudUpload, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { uploadToCloudinary } from "@/utils/uploadToCloudinary";

import { deleteTempImage } from "@/lib/delete-temp-image";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

type Props<T extends FieldValues> = {
    form: UseFormReturn<T>;
    urlName: Path<T>;
    publicIdName: Path<T>;
    className?: string;
    folderName: string;
};

export default function TDImageUploadField<T extends FieldValues>({
    form,
    urlName,
    publicIdName,
    className,
    folderName,
}: Props<T>) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);

    const url = form.watch(urlName);

    const handleUpload = async (file: File) => {
        try {
            setLoading(true);

            // If there's already a temp image loaded, delete it first
            const currentPublicId = form.getValues(publicIdName);
            if (currentPublicId && String(currentPublicId).includes("/temp/")) {
                await deleteTempImage(currentPublicId);
            }
            const uploaded = await uploadToCloudinary(file, folderName);

            form.setValue(urlName, uploaded.url);
            form.setValue(publicIdName, uploaded.publicId);

            toast.success("Image uploaded successfully!");
        } catch (error: any) {
            console.error("Upload failed:", error);
            form.setValue(urlName, "" as any);
            form.setValue(publicIdName, "" as any);
            if (fileRef.current) fileRef.current.value = "";

            // Show error to user
            toast.error(error?.message || "Failed to upload image");
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (file: File) => {
        if (file.size > 2 * 1024 * 1024) {
            toast.error("File is too big. Maximum size is 2MB.");
            return;
        }
        handleUpload(file);
    };

    const handleRemove = async () => {
        const currentPublicId = form.getValues(publicIdName);

        // Delete from Cloudinary if it's a temp image
        if (currentPublicId && String(currentPublicId).includes("/temp/")) {
            await deleteTempImage(currentPublicId);
        }

        form.setValue(urlName, "" as any);
        form.setValue(publicIdName, "" as any);
        if (fileRef.current) fileRef.current.value = "";
        toast("Image removed");
    };

    return (
        <div className="space-y-2">
            <div className="relative w-full h-36 border rounded-md bg-gray-100">
                {url ? (
                    <>
                        <Image
                            src={url}
                            alt="Preview"
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover rounded-md w-full"
                            priority={true}
                        />
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="absolute -top-2 -right-2 bg-black text-white rounded-full p-1"
                        >
                            <X size={14} />
                        </button>
                    </>
                ) : (
                    <div
                        className={cn(
                            "w-full h-full flex items-center justify-center cursor-pointer",
                            className,
                        )}
                        onClick={() => fileRef.current?.click()}
                    >
                        <p className="text-muted-foreground text-sm">
                            No image selected
                        </p>
                    </div>
                )}
                {form.formState.errors[urlName] && (
                    <p className="text-red-500 text-xs mt-1">
                        {form.formState.errors[urlName]?.message as string}
                    </p>
                )}
            </div>

            <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                className="w-full flex items-center gap-2"
            >
                {loading ? (
                    "Uploading..."
                ) : (
                    <>
                        <CloudUpload /> <span>Upload Image</span>
                    </>
                )}
            </Button>

            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(file);
                }}
            />
        </div>
    );
}
```
