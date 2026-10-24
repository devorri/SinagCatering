import { supabase } from './supabase'

export const STORAGE_BUCKET = 'Files'

export interface UploadResult {
  url: string
  path?: string
  error?: string
}

/**
 * Uploads an image file to Supabase storage bucket 'Files'.
 * Automatically handles public URL generation and falls back to Base64 if storage is unreachable.
 *
 * @param file - The browser File object to upload
 * @param folder - Folder namespace within the bucket ('menu' | 'packages' | 'receipts' | 'general')
 */
export async function uploadImageToStorage(
  file: File,
  folder: 'menu' | 'packages' | 'receipts' | 'general' = 'general',
): Promise<UploadResult> {
  if (!file) {
    return { url: '', error: 'No file provided.' }
  }

  // Sanitize filename & extension
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const cleanName = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 30)
  const filePath = `${folder}/${cleanName}_${Date.now().toString().slice(-6)}.${ext}`

  if (supabase) {
    try {
      let bucket = STORAGE_BUCKET
      let res = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

      // Fallback to lowercase 'files' if bucket casing differs
      if (res.error && /bucket not found/i.test(res.error.message)) {
        bucket = 'files'
        res = await supabase.storage.from(bucket).upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })
      }

      if (!res.error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
        if (data?.publicUrl) {
          return { url: data.publicUrl, path: filePath }
        }
      } else {
        console.warn('Supabase storage upload error:', res.error.message)
      }
    } catch (err: any) {
      console.warn('Error during Supabase storage upload:', err?.message || err)
    }
  }

  // Graceful fallback to DataURL so workflows are never blocked
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve({ url: reader.result as string })
    }
    reader.onerror = () => {
      resolve({ url: '', error: 'Failed to read file.' })
    }
    reader.readAsDataURL(file)
  })
}
