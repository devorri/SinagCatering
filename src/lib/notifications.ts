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

  // Dispatch custom window event so UI can react in real time
  window.dispatchEvent(new CustomEvent('sinag-notification-sent', { detail: newLog }))

  return newLog
}

export const clearNotificationLogs = () => {
  localStorage.removeItem(LOCAL_STORAGE_LOGS_KEY)
  window.dispatchEvent(new CustomEvent('sinag-notification-sent'))
}

// Clean and normalize Philippine mobile numbers (e.g. "0928 714 4597" -> "09287144597")
export const normalizePhPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/[^0-9+]/g, '')
  if (cleaned.startsWith('+63')) {
    cleaned = '0' + cleaned.slice(3)
  } else if (cleaned.startsWith('63') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(2)
  }
  return cleaned
}

/**
 * Dispatch SMS through the server-side Supabase function.
 */
export const sendSemaphoreSMS = async (
  recipientPhone: string,
  message: string,
  referenceId?: string,
): Promise<{ success: boolean; simulated: boolean; error?: string }> => {
  const cleanedPhone = normalizePhPhoneNumber(recipientPhone)

  if (!supabase) {
    logNotification({
      type: 'sms',
      recipient: cleanedPhone,
      message,
      status: 'simulated',
      provider: 'Semaphore',
      referenceId,
    })
    return { success: true, simulated: true }
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: { recipientPhone: cleanedPhone, message, referenceId },
    })

    if (error || data?.success === false) {
      const errText = error?.message ?? data?.error ?? 'SMS dispatch failed'
      logNotification({
        type: 'sms',
        recipient: cleanedPhone,
        message: `${message} [Error: ${errText}]`,
        status: 'failed',
        provider: 'Semaphore',
        referenceId,
      })
      return { success: false, simulated: false, error: errText }
    }

    const simulated = data?.simulated === true
    logNotification({
      type: 'sms',
      recipient: cleanedPhone,
      message,
      status: simulated ? 'simulated' : 'sent',
      provider: 'Semaphore',
      referenceId,
    })

    return { success: true, simulated }
  } catch (error: unknown) {
    console.error('Failed to trigger Semaphore SMS:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logNotification({
      type: 'sms',
      recipient: cleanedPhone,
      message: `${message} [Network Error: ${errorMessage}]`,
      status: 'failed',
      provider: 'Semaphore',
      referenceId,
    })
    return { success: false, simulated: false, error: errorMessage }
  }
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
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined

  if (serviceId && templateId && publicKey) {
    try {
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
            to_name: recipientEmail.split('@')[0],
            subject: subject,
            message: body,
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
          message: `${body} [EmailJS Warning: ${errText}]`,
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
        message: body,
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
        message: `${body} [Network Error: ${errorMessage}]`,
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
    message: body,
    status: 'simulated',
    provider: 'Email',
    referenceId,
  })

  return { success: true, simulated: true }
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
