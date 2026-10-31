import { supabase as db } from './supabase'

export const gamificationService = {
  /**
   * Checks all available badges and awards those that the user meets the criteria for.
   */
  async checkAndAwardBadges(userId) {
    try {
      // 1. Fetch all available badges
      const { data: badges, error: badgeError } = await db.from('badges').select('*')
      if (badgeError) throw badgeError

      // 2. Fetch badges the user already has
      const { data: userBadges, error: ubError } = await db
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId)
      if (ubError) throw ubError

      const earnedBadgeIds = new Set(userBadges?.map(b => b.badge_id) || [])
      const newBadgesAwarded = []

      // 3. Gather user stats for criteria checking
      const [notebooks, studyDays, chats] = await Promise.all([
        db.from('notebooks').select('subject').eq('user_id', userId),
        db.from('study_days').select('*').eq('user_id', userId),
        db.from('chat_messages').select('*').eq('user_id', userId)
      ])

      const stats = {
        notebooks_count: notebooks.data?.length || 0,
        subjects_count: new Set(notebooks.data?.map(n => n.subject) || []).size,
        streak_days: studyDays.data?.length || 0, // Simplified: total study days
        chat_count: chats.data?.length || 0
      }

      // 4. Check each badge
      for (const badge of badges) {
        if (!earnedBadgeIds.has(badge.id)) {
          const userValue = stats[badge.criteria_type] || 0
          if (userValue >= badge.criteria_value) {
            const { error: awardError } = await db.from('user_badges').insert({
              user_id: userId,
              badge_id: badge.id
            })

            if (!awardError) {
              newBadgesAwarded.push(badge)
            }
          }
        }
      }

      return newBadgesAwarded
    } catch (error) {
      console.error('Error checking badges:', error)
      return []
    }
  },

  /**
   * Retrieves all badges earned by a user including their details.
   */
  async getUserBadges(userId) {
    const { data, error } = await db
      .from('user_badges')
      .select(`
        earned_at,
        badges (
          id,
          name,
          description,
          icon
        )
      `)
      .eq('user_id', userId)

    if (error) throw error
    return data?.map(ub => ({ ...ub.badges, earned_at: ub.earned_at })) || []
  }
}
