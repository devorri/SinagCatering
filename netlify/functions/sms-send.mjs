export const handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: 'OK',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const apiKey =
      process.env.VITE_SEMAPHORE_API_KEY ||
      process.env.SEMAPHORE_API_KEY ||
      'f18fe7eb9f2f4b5477776b98d8b55565'

    const rawPhone = (body.recipientPhone || body.phone || body.number || '').toString()
    const phoneDigits = rawPhone.replace(/[^0-9]/g, '')
    const message = (body.message || '').trim()

    if (!phoneDigits || !message) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Phone number and message are required' }),
      }
    }

    // Normalize Philippine mobile numbers to international format (639XXXXXXXXX)
    let formattedPhone = phoneDigits
    if (formattedPhone.startsWith('09') && formattedPhone.length === 11) {
      formattedPhone = '63' + formattedPhone.slice(1)
    } else if (formattedPhone.startsWith('9') && formattedPhone.length === 10) {
      formattedPhone = '63' + formattedPhone
    } else if (formattedPhone.startsWith('639') && formattedPhone.length === 12) {
      // already normalized
    }

    const sendToSemaphore = async (sender) => {
      const paramsObj = {
        apikey: apiKey,
        number: formattedPhone,
        message,
      }
      if (sender && sender.toUpperCase() !== 'SEMAPHORE') {
        paramsObj.sendername = sender
      }
      const params = new URLSearchParams(paramsObj)
      const semRes = await fetch('https://api.semaphore.co/api/v4/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })
      const semData = await semRes.json().catch(() => null)
      return { semRes, semData }
    }

    const preferredSender = (
      process.env.VITE_SEMAPHORE_SENDER_NAME ||
      process.env.SEMAPHORE_SENDER_NAME ||
      'SinagsCater'
    ).trim()

    let { semRes, semData } = await sendToSemaphore(preferredSender)

    // Fallback if custom sender name is rejected or unapproved
    const hasSenderError = Array.isArray(semData) && semData.some((item) => item?.senderName)
    if (!semRes.ok && hasSenderError) {
      const retry = await sendToSemaphore(undefined)
      semRes = retry.semRes
      semData = retry.semData
    }

    const semItems = Array.isArray(semData)
      ? semData
      : semData && typeof semData === 'object' && semData.message_id
        ? [semData]
        : []
    const firstMsg = semItems[0] || (typeof semData === 'object' ? semData : null)
    const success =
      semRes.ok &&
      Boolean(firstMsg?.message_id || firstMsg?.status === 'Pending' || firstMsg?.status === 'Queued')

    if (success) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: semData,
          message_id: firstMsg?.message_id,
          network: firstMsg?.network,
          status: firstMsg?.status || 'Pending',
        }),
      }
    }

    const errMsg =
      Array.isArray(semData) && semData[0]?.senderName
        ? semData[0].senderName
        : semData?.error ||
          (typeof semData === 'string' ? semData : 'Semaphore rejected message delivery')

    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: errMsg,
        data: semData,
      }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err?.message || 'Internal server error' }),
    }
  }
}
