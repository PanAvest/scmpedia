import './_runtime.js'
import type { SupabaseClient } from '@supabase/supabase-js'

export type StudentRecord = {
  id: string
  email: string
  full_name: string
  country: string
  country_code: string
  university: string
  university_custom: boolean
  index_number: string
  programme: string
  saved_at: string
  plan: string
  created_at: string
}

export type CustomUniversity = { name: string; count: number }

// Walk every auth user (paged) and pull out those who completed the student
// verification popup (fields live in user_metadata as student_* keys). Also
// aggregates the free-typed university names so new schools can be promoted
// into src/data/universities.ts.
export async function collectStudents(service: SupabaseClient): Promise<{ students: StudentRecord[]; customUniversities: CustomUniversity[] }> {
  const students: StudentRecord[] = []
  const customCounts = new Map<string, number>()
  const perPage = 200
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Could not list users: ${error.message}`)
    const users = data?.users || []
    for (const u of users) {
      const meta = (u.user_metadata || {}) as Record<string, unknown>
      const university = String(meta.student_university || '').trim()
      const indexNumber = String(meta.student_index_number || '').trim()
      if (!university || !indexNumber) continue
      const isCustom = Boolean(meta.student_university_custom)
      const subscription = (u.app_metadata as Record<string, any> | undefined)?.scmpedia_subscription
      const subExpires = typeof subscription?.expires_at === 'string' ? subscription.expires_at : ''
      const subActive = subscription?.tier === 'premium' && (!subExpires || new Date(subExpires).getTime() > Date.now())
      students.push({
        id: u.id,
        email: u.email || '',
        full_name: String(meta.full_name || ''),
        country: String(meta.student_country || ''),
        country_code: String(meta.student_country_code || ''),
        university,
        university_custom: isCustom,
        index_number: indexNumber,
        programme: String(meta.student_programme || ''),
        saved_at: String(meta.student_verified_at || ''),
        plan: subActive ? String(subscription?.plan || 'premium') : '',
        created_at: u.created_at || '',
      })
      if (isCustom && university) customCounts.set(university, (customCounts.get(university) || 0) + 1)
    }
    if (users.length < perPage) break
  }
  students.sort((a, b) => (b.saved_at || b.created_at).localeCompare(a.saved_at || a.created_at))
  const customUniversities = [...customCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return { students, customUniversities }
}
