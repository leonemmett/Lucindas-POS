import { supabase } from './supabaseClient'

export async function uploadReceiptPdf(blob: Blob): Promise<string> {
  const path = `${crypto.randomUUID()}.pdf`
  const { error } = await supabase.storage.from('receipts').upload(path, blob, {
    contentType: 'application/pdf',
    cacheControl: '31536000',
  })
  if (error) throw error

  const { data } = supabase.storage.from('receipts').getPublicUrl(path)
  return data.publicUrl
}
