import { supabase } from './supabase'

export const STORAGE_BUCKET = 'Files'

export interface UploadResult {
  url: string
  path?: string
  error?: string
}

/**
 * Compresses and converts an image File to lightweight WebP in the browser
 * (max dimension 1400px, quality 0.80) before uploading to Supabase Storage.
 * Falls back to the original File if the browser cannot decode the image.
 */
async function compressImageToWebp(file: File, maxDim = 1400, quality = 0.8): Promise<{ blob: Blob | File; ext: string; contentType: string }> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    return { blob: file, ext, contentType: file.type || 'image/jpeg' }
  }

  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      try {
        let { width, height } = img
        if (Math.max(width, height) > maxDim) {
          const scale = maxDim / Math.max(width, height)
          width = Math.max(1, Math.round(width * scale))
          height = Math.max(1, Math.round(height * scale))
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
          resolve({ blob: file, ext, contentType: file.type || 'image/jpeg' })
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (webpBlob) => {
            if (webpBlob && webpBlob.size > 0) {
              resolve({ blob: webpBlob, ext: 'webp', contentType: 'image/webp' })
            } else {
              const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
              resolve({ blob: file, ext, contentType: file.type || 'image/jpeg' })
            }
          },
          'image/webp',
          quality,
        )
      } catch {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        resolve({ blob: file, ext, contentType: file.type || 'image/jpeg' })
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      resolve({ blob: file, ext, contentType: file.type || 'image/jpeg' })
    }

    img.src = objectUrl
  })
}

/**
 * Uploads an image file to Supabase storage bucket 'Files' after converting it to lightweight WebP.
 * Returns the public URL, or an error if the upload fails (never a base64 data URL).
 *
 * @param file - The browser File object to upload
 * @param folder - Folder namespace within the bucket ('menu' | 'packages' | 'receipts' | 'gallery' | 'general')
 */
export async function uploadImageToStorage(
  file: File,
  folder: 'menu' | 'packages' | 'receipts' | 'gallery' | 'general' = 'general',
): Promise<UploadResult> {
  if (!file) {
    return { url: '', error: 'No file provided.' }
  }

  const { blob, ext, contentType } = await compressImageToWebp(file)

  const cleanName = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 30)
  const filePath = `${folder}/${cleanName}_${Date.now().toString().slice(-6)}.${ext}`

  if (supabase) {
    try {
      let bucket = STORAGE_BUCKET
      let res = await supabase.storage.from(bucket).upload(filePath, blob, {
        cacheControl: '31536000',
        contentType,
        upsert: true,
      })

      // Fallback to lowercase 'files' if bucket casing differs
      if (res.error && /bucket not found/i.test(res.error.message)) {
        bucket = 'files'
        res = await supabase.storage.from(bucket).upload(filePath, blob, {
          cacheControl: '31536000',
          contentType,
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

  // No base64 fallback: storing images as data URLs inside DB rows bloats every
  // query and burns Supabase egress. Fail loudly so the user can retry.
  return { url: '', error: 'Upload failed. Please check your connection and try again.' }
}
