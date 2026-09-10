import { Capacitor, registerPlugin } from '@capacitor/core'

const NativeStudyWidget = registerPlugin('StudyWidget')

export const widgetService = {
  async sync(streak) {
    if (!Capacitor.isNativePlatform()) return
    await NativeStudyWidget.sync({
      streak: Number(streak?.streak) || 0,
      studiedToday: Boolean(streak?.studiedToday)
    })
  },

  async clear() {
    if (!Capacitor.isNativePlatform()) return
    await NativeStudyWidget.clear()
  }
}
