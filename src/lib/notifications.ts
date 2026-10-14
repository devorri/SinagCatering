import type { Booking, NotificationLog } from '../types'
import { supabase } from './supabase'
import { formatMoney } from '../data/packages'

const LOCAL_STORAGE_LOGS_KEY = 'sinag_notification_logs'
if (typeof localStorage !== 'undefined') {
  localStorage.removeItem('sinag_semaphore_api_key')
}

export const getNotificationLogs = (): NotificationLog[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const logNotification = (log: Omit<NotificationLog, 'id' | 'timestamp'>): NotificationLog => {
  const newLog: NotificationLog = {
    ...log,
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
  }

  const existing = getNotificationLogs()
  const updated = [newLog, ...existing].slice(0, 100) // Keep last 100 logs
  localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(updated))

  // Also persist to Supabase notification_logs table if accessible
  if (supabase) {
    void (async () => {
      try {
        const { error } = await supabase.from('notification_logs').insert({
          id: newLog.id,
          type: newLog.type,
          recipient: newLog.recipient,
          subject: newLog.subject || null,
          message: newLog.message,
          status: newLog.status,
          provider: newLog.provider,
          reference_id: newLog.referenceId || null,
          created_at: newLog.timestamp,
        })
        if (error) console.warn('Could not save notification log to Supabase:', error.message)
      } catch {
        // ignore
      }
    })()
  }

  // Dispatch custom window event so UI can react in real time
  window.dispatchEvent(new CustomEvent('sinag-notification-sent', { detail: newLog }))

  return newLog
}

export const clearNotificationLogs = () => {
  localStorage.removeItem(LOCAL_STORAGE_LOGS_KEY)
  window.dispatchEvent(new CustomEvent('sinag-notification-sent'))
}

// Clean and normalize Philippine mobile numbers to international format (e.g. "0928 714 4597" -> "639287144597")
export const normalizePhPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.startsWith('09') && digits.length === 11) {
    return '63' + digits.slice(1) // 639XXXXXXXXX
  }
  if (digits.startsWith('639') && digits.length === 12) {
    return digits
  }
  if (digits.startsWith('9') && digits.length === 10) {
    return '63' + digits
  }
  return digits
}

/**
 * Dispatch SMS through the API endpoint or server-side Supabase function.
 */
export const sendSemaphoreSMS = async (
  recipientPhone: string,
  message: string,
  referenceId?: string,
): Promise<{ success: boolean; simulated: boolean; error?: string }> => {
  const cleanedPhone = normalizePhPhoneNumber(recipientPhone)
  let lastErrorMessage = 'SMS delivery was not accepted by the configured server endpoint.'

  // 1. Try local Vite API server endpoint (direct Semaphore dispatch via server)
  try {
    const apiRes = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientPhone: cleanedPhone, message, referenceId }),
    })
    const result = await apiRes.json().catch(() => null)
    if (apiRes.ok && result?.success) {
      const item = Array.isArray(result.data) ? result.data[0] : (result.data || null)
      const msgId = result.message_id || item?.message_id
      const network = result.network || item?.network
      const status = result.status || item?.status || 'Queued'
      const enrichedMessage = msgId
        ? `${message} [Semaphore ID: ${msgId} | Net: ${network || 'PH'} | Status: ${status}]`
        : message

      logNotification({
        type: 'sms',
        recipient: cleanedPhone,
        message: enrichedMessage,
        status: 'sent',
        provider: 'Semaphore',
        referenceId: referenceId || (msgId ? String(msgId) : undefined),
      })
      return { success: true, simulated: false }
    } else if (result?.error) {
      lastErrorMessage = String(result.error)
    }
  } catch (err: any) {
    if (err?.message) lastErrorMessage = err.message
  }

  // 2. Fall back to Supabase Edge Function ('send-sms')
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: { recipientPhone: cleanedPhone, message, referenceId },
      })

      if (!error && data?.success === true) {
        const simulated = data?.simulated === true
        const msgId = data?.message_id
        const enrichedMessage = msgId
          ? `${message} [Edge Function | Semaphore ID: ${msgId} | Status: ${data?.status || 'Queued'}]`
          : message

        logNotification({
          type: 'sms',
          recipient: cleanedPhone,
          message: enrichedMessage,
          status: simulated ? 'simulated' : 'sent',
          provider: 'Semaphore',
          referenceId,
        })
        return { success: true, simulated }
      } else if (error?.message) {
        lastErrorMessage = error.message
      }
    } catch (edgeErr: any) {
      if (edgeErr?.message) lastErrorMessage = edgeErr.message
    }
  }

  logNotification({
    type: 'sms',
    recipient: cleanedPhone,
    message: `${message} [Failed: ${lastErrorMessage}]`,
    status: 'failed',
    provider: 'Semaphore',
    referenceId,
  })
  return { success: false, simulated: false, error: lastErrorMessage }
}

/**
 * Dispatch transactional email payload.
 */
export const sendTransactionalEmail = async (
  recipientEmail: string,
  subject: string,
  body: string,
  referenceId?: string,
): Promise<{ success: boolean; simulated?: boolean; error?: string }> => {
  // Replace generic boilerplate placeables like [Company Name] with official branding
  const formattedBody = body.replace(/\[Company Name\]/g, 'Sinag Catering Services')

  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined
  const templateId = (import.meta.env.VITE_EMAILJS_TRANSACTIONAL_TEMPLATE_ID || import.meta.env.VITE_EMAILJS_TEMPLATE_ID) as string | undefined
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined

  if (serviceId && templateId && publicKey) {
    try {
      const expiryDate = new Date(Date.now() + 15 * 60 * 1000)
      const formattedTime = expiryDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            to_email: recipientEmail,
            email: recipientEmail,
            to_name: recipientEmail.split('@')[0],
            subject: subject,
            message: formattedBody,
            // CRITICAL FIX: Replace raw UUID string with the formatted message payload
            // so even if EmailJS template is rendering {{passcode}}, the recipient gets
            // the full formatted transactional text rather than a raw UUID like 'bk-f9bec...'
            passcode: formattedBody,
            company_name: "Sinag Catering Services",
            company: "Sinag Catering Services",
            time: formattedTime,
            reference_id: referenceId || '',
          },
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.warn('EmailJS response warning:', errText)
        logNotification({
          type: 'email',
          recipient: recipientEmail,
          subject,
          message: `${formattedBody} [EmailJS Warning: ${errText}]`,
          status: 'failed',
          provider: 'Email',
          referenceId,
        })
        return { success: false, simulated: false, error: errText }
      }

      logNotification({
        type: 'email',
        recipient: recipientEmail,
        subject,
        message: formattedBody,
        status: 'sent',
        provider: 'Email',
        referenceId,
      })
      return { success: true, simulated: false }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to trigger EmailJS email:', err)
      logNotification({
        type: 'email',
        recipient: recipientEmail,
        subject,
        message: `${formattedBody} [Network Error: ${errorMessage}]`,
        status: 'failed',
        provider: 'Email',
        referenceId,
      })
      return { success: false, simulated: false, error: errorMessage }
    }
  }

  logNotification({
    type: 'email',
    recipient: recipientEmail,
    subject,
    message: formattedBody,
    status: 'simulated',
    provider: 'Email',
    referenceId,
  })

  return { success: true, simulated: true }
}

/**
 * Trigger Email OTP verification code to client matching EmailJS template {{passcode}} & {{time}}
 */
export const sendEmailOTP = async (
  recipientEmail: string,
  otpCode: string,
): Promise<{ success: boolean; simulated?: boolean; error?: string }> => {
  const expiryDate = new Date(Date.now() + 15 * 60 * 1000)
  const formattedTime = expiryDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  // Use the exact customized template provided
  const otpMessage = `To authenticate, please use the following One Time Password (OTP):

${otpCode}

This OTP will be valid for 15 minutes till ${formattedTime}.

Do not share this OTP with anyone. If you didn't make this request, you can safely ignore this email.
Sinag's Cater will never contact you about this email or ask for any login codes or links. Beware of phishing scams.

Thanks for visiting Sinag's Cater!`

  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined

  if (!serviceId || !templateId || !publicKey) {
    logNotification({
      type: 'email',
      recipient: recipientEmail,
      subject: "Sinag's Cater OTP Verification",
      message: otpMessage,
      status: 'simulated',
      provider: 'Email',
      referenceId: 'OTP-VERIFY',
    })
    return { success: true, simulated: true }
  }

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: recipientEmail,
          email: recipientEmail,
          to_name: recipientEmail.split('@')[0],
          passcode: otpCode,
          time: formattedTime,
          message: otpMessage,
          company_name: "Sinag's Cater",
          company: "Sinag's Cater",
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      logNotification({
        type: 'email',
        recipient: recipientEmail,
        subject: "Sinag's Cater OTP Verification",
        message: `${otpMessage} [Warning: ${errText}]`,
        status: 'failed',
        provider: 'Email',
        referenceId: 'OTP-VERIFY',
      })
      return { success: false, simulated: false, error: errText }
    }

    logNotification({
      type: 'email',
      recipient: recipientEmail,
      subject: "Sinag's Cater OTP Verification",
      message: otpMessage,
      status: 'sent',
      provider: 'Email',
      referenceId: 'OTP-VERIFY',
    })
    return { success: true, simulated: false }
  } catch (err: any) {
    logNotification({
      type: 'email',
      recipient: recipientEmail,
      subject: "Sinag's Cater OTP Verification",
      message: `${otpMessage} [Error: ${err.message}]`,
      status: 'failed',
      provider: 'Email',
      referenceId: 'OTP-VERIFY',
    })
    return { success: false, error: err.message }
  }
}

/**
 * Trigger SMS OTP verification code to client
 */
export const sendRegistrationOTP = async (phone: string, otp: string) => {
  const message = `[Sinag Catering] Your verification OTP is: ${otp}. Valid for 10 minutes. Use this to verify your reservation account.`
  return await sendSemaphoreSMS(phone, message, 'OTP-VERIFY')
}

/**
 * Trigger Booking Submission alerts (SMS + Email)
 */
export const sendBookingSubmissionNotifications = async (booking: Booking) => {
  const downpaymentReq = booking.downpaymentAmount || Math.round(booking.totalPrice * 0.5)
  const currency = booking.currency ?? 'PHP'
  const smsText = `[Sinag Catering] Mabuhay ${booking.customerName}! Your booking request #${booking.id} for ${booking.eventDate} (${booking.guestCount} pax) has been submitted. 50% Downpayment: ${formatMoney(downpaymentReq, currency)}. Contact: 0928 714 4597.`
  
  await sendSemaphoreSMS(booking.phone, smsText, booking.id)

  const emailSubject = `Sinag Catering: Booking Request Received #${booking.id}`
  const emailBody = `Dear ${booking.customerName},\n\nThank you for choosing Sinag's Catering Services!\n\nBooking ID: ${booking.id}\nEvent Type: ${booking.eventType}\nEvent Date: ${booking.eventDate}\nGuest Count: ${booking.guestCount} pax\nTotal Estimate: ${formatMoney(booking.totalPrice, currency)}\n50% Downpayment: ${formatMoney(downpaymentReq, currency)}\nPayment Method: ${booking.paymentMethod?.toUpperCase() || 'GCash / QR Ph'}\nReference No.: ${booking.gcashRefNumber || 'Pending'}\n\nOur concierge desk is reviewing your reservation. Once downpayment is verified, your date will be locked.\n\nWarm regards,\nSinag Catering Services Team\nBaliwag, Bulacan | Hotline: 0928 714 4597`

  await sendTransactionalEmail(booking.email, emailSubject, emailBody, booking.id)
}

/**
 * Trigger Downpayment Verification alerts (SMS + Email)
 */
export const sendPaymentVerificationNotifications = async (booking: Booking) => {
  const verifiedAmount = booking.downpaymentAmount || Math.round(booking.totalPrice * 0.5)
  const currency = booking.currency ?? 'PHP'
  const smsText = `[Sinag Catering] Payment Verified! Downpayment of ${formatMoney(verifiedAmount, currency)} for Booking #${booking.id} (${booking.eventDate}) is verified. Your event date is locked in our calendar! Salamat po!`

  await sendSemaphoreSMS(booking.phone, smsText, booking.id)

  const emailSubject = `Sinag Catering: Downpayment Verified & Booking Confirmed! #${booking.id}`
  const emailBody = `Mabuhay ${booking.customerName}!\n\nWe are pleased to inform you that your 50% downpayment of ${formatMoney(verifiedAmount, currency)} has been verified by our management team.\n\nBooking Reference: #${booking.id}\nScheduled Date: ${booking.eventDate}\nPackage: ${booking.packageName}\nStatus: Confirmed / Downpayment Verified\nRemaining Balance: ${formatMoney(booking.totalPrice - verifiedAmount, currency)} (Payable on event day)\n\nOur event coordinator and kitchen team are now prepping your banquet.\n\nThank you for trusting Sinag's Catering Services!\nHotline: 0928 714 4597`

  await sendTransactionalEmail(booking.email, emailSubject, emailBody, booking.id)
}
