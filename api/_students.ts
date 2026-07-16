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

export type SubscriberStats = {
  totalUsers: number
  premiumTotal: number         // every active-premium account (paid or comped)
  paidPremiumTotal: number     // premiumTotal minus comps
  compTotal: number            // admin-granted comps (subset of premiumTotal)
  premiumStudents: number      // active premium on a student plan
  premiumPros: number          // active premium on a professional plan
  studentPremiumTotal: number  // active premium AND a verified student
  verifiedStudents: number     // completed student verification
  // Actual money received (successful rows in scmpedia_payments), in Ghana Cedis.
  revenue: {
    total: number
    student: number
    pro: number
    paymentCount: number
    byPlan: Record<string, { count: number; amount: number }>
  }
}

const isStudentPlan = (plan: string) => plan.startsWith('student')
const isProPlan = (plan: string) => plan.startsWith('pro')

// Sum successful payments from scmpedia_payments (amounts are stored in pesewas → /100 for GHS).
async function collectRevenue(service: SupabaseClient): Promise<SubscriberStats['revenue']> {
  const revenue = { total: 0, student: 0, pro: 0, paymentCount: 0, byPlan: {} as Record<string, { count: number; amount: number }> }
  try {
    const { data, error } = await service.from('scmpedia_payments').select('plan,amount,status')
    if (error || !data) return revenue
    for (const row of data as { plan?: string; amount?: number; status?: string }[]) {
      if (String(row.status) !== 'success') continue
      const plan = String(row.plan || 'unknown')
      const ghs = (Number(row.amount) || 0) / 100
      revenue.total += ghs
      revenue.paymentCount += 1
      if (isStudentPlan(plan)) revenue.student += ghs
      else if (isProPlan(plan)) revenue.pro += ghs
      const bucket = revenue.byPlan[plan] || { count: 0, amount: 0 }
      bucket.count += 1
      bucket.amount += ghs
      revenue.byPlan[plan] = bucket
    }
  } catch {
    /* payments table optional */
  }
  return revenue
}

// Walk every auth user (paged) and pull out those who completed the student
// verification popup (fields live in user_metadata as student_* keys). Also
// aggregates the free-typed university names so new schools can be promoted
// into src/data/universities.ts.
export async function collectStudents(service: SupabaseClient): Promise<{ students: StudentRecord[]; customUniversities: CustomUniversity[]; stats: SubscriberStats }> {
  const students: StudentRecord[] = []
  const customCounts = new Map<string, number>()
  const stats: SubscriberStats = {
    totalUsers: 0, premiumTotal: 0, paidPremiumTotal: 0, compTotal: 0,
    premiumStudents: 0, premiumPros: 0, studentPremiumTotal: 0, verifiedStudents: 0,
    revenue: { total: 0, student: 0, pro: 0, paymentCount: 0, byPlan: {} },
  }
  const perPage = 200
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Could not list users: ${error.message}`)
    const users = data?.users || []
    for (const u of users) {
      stats.totalUsers += 1
      const meta = (u.user_metadata || {}) as Record<string, unknown>
      const subscription = (u.app_metadata as Record<string, any> | undefined)?.scmpedia_subscription
      const subExpires = typeof subscription?.expires_at === 'string' ? subscription.expires_at : ''
      const subActive = subscription?.tier === 'premium' && (!subExpires || new Date(subExpires).getTime() > Date.now())
      const university = String(meta.student_university || '').trim()
      const indexNumber = String(meta.student_index_number || '').trim()
      const isStudent = Boolean(university && indexNumber)
      if (isStudent) stats.verifiedStudents += 1
      if (subActive) {
        const plan = String(subscription?.plan || '')
        stats.premiumTotal += 1
        if (subscription?.source === 'admin' || plan === 'comp') stats.compTotal += 1
        else stats.paidPremiumTotal += 1
        if (isStudentPlan(plan)) stats.premiumStudents += 1
        else if (isProPlan(plan)) stats.premiumPros += 1
        if (isStudent) stats.studentPremiumTotal += 1
      }
      if (!isStudent) continue
      const isCustom = Boolean(meta.student_university_custom)
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
  stats.revenue = await collectRevenue(service)
  return { students, customUniversities, stats }
}
