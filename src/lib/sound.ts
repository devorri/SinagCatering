import notificationSoundUrl from '../assets/sounds/notification-sound.mp3'

let audioInstance: HTMLAudioElement | null = null

/**
 * Plays the official Sinag notification chime (notification-sound.mp3).
 * Handles browser autoplay policy gracefully.
 */
export const playNotificationSound = () => {
  try {
    if (typeof window === 'undefined') return

    if (!audioInstance) {
      audioInstance = new Audio(notificationSoundUrl)
      audioInstance.volume = 0.75
    }

    // Reset timestamp so rapid notifications chime each time
    audioInstance.currentTime = 0
    const promise = audioInstance.play()

    if (promise !== undefined) {
      promise.catch((err) => {
        // Browsers block unprompted audio until user clicks something on the page
        console.info('Audio autoplay pending user gesture:', err)
      })
    }
  } catch (err) {
    console.warn('Audio initialization error:', err)
  }
}
