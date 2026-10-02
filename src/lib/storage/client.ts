import "server-only";
import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { NotFoundError } from "@/lib/errors/classes";

export interface StorageObject {
  id: string;
  path: string;
  size: number;
}

function getBucket() {
  return env().SUPABASE_STORAGE_BUCKET;
}

export async function downloadDocument(
  storagePath: string
): Promise<Uint8Array> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage
    .from(getBucket())
    .download(storagePath);

  if (error) {
    throw new NotFoundError("Document file not found in storage.", {
      code: "STORAGE_FILE_NOT_FOUND",
      userMessage: "The document file could not be found.",
    });
  }

  return new Uint8Array(await data.arrayBuffer());
}

export async function storageObjectExists(storagePath: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage
    .from(getBucket())
    .list(storagePath.split("/").slice(0, -1).join("/"), {
      search: storagePath.split("/").pop(),
    });

  if (error || !data) {
    return false;
  }

  return data.some((item) => item.name === storagePath.split("/").pop());
}

export async function deleteDocumentFromStorage(
  storagePath: string
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.storage
    .from(getBucket())
    .remove([storagePath]);

  if (error) {
    throw new NotFoundError("Could not delete document from storage.", {
      code: "STORAGE_DELETE_FAILED",
      userMessage: "The file could not be removed from storage.",
    });
  }
}

export async function deleteUserStorageFolder(userId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.storage.from(getBucket()).remove([`${userId}`]);

  if (error) {
    throw new NotFoundError("Could not remove user storage.", {
      code: "STORAGE_DELETE_FAILED",
      userMessage: "User storage cleanup failed.",
    });
  }
}