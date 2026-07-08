// Seed (or remove) sample verified UMaT students with an active Student-plan
// subscription, so the Grand Draw has a real pool to draw from.
//
//   node scripts/raffle-test-students.mjs seed     # create ~40 test students
//   node scripts/raffle-test-students.mjs clean    # delete every @raffle-test.local user
//
// They use the email domain @raffle-test.local so they are trivial to clean up
// and never collide with real accounts. Writes go through SUPABASE_SERVICE_ROLE_KEY.

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Node < 22 has no global WebSocket; supabase-js builds a realtime client at
// construction. We never open a realtime channel here, so a harmless stub is enough.
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = class {}

// --- env (prefer real env, fall back to .env.local) --------------------------
const env = { ...process.env }
try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  /* no .env.local — rely on process.env */
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const DOMAIN = 'raffle-test.local'
const UNIVERSITY = 'University of Mines and Technology (UMaT)'
const COUNT = 40

const firsts = ['Kwame','Ama','Kofi','Akosua','Yaw','Abena','Kwabena','Adwoa','Kwaku','Efua','Kojo','Esi','Fiifi','Araba','Nana','Akua','Yaa','Kwesi','Maame','Selorm','Elikem','Delali','Senam','Mawuli','Afia','Bright','Gifty','Emmanuel','Priscilla','Isaac','Naa','Perpetual','Prince','Belinda','Joseph','Comfort','Daniel','Vida','Michael','Grace']
const lasts = ['Mensah','Boateng','Owusu','Asante','Addo','Agyeman','Osei','Danso','Frimpong','Appiah','Ofori','Sarpong','Nkrumah','Quaye','Tetteh','Annan','Bediako','Amankwah','Gyasi','Baffour','Antwi','Yeboah','Aidoo','Darko','Opoku','Acheampong','Nyarko','Amoah','Bonsu','Asamoah','Duah','Ansah','Kyei','Adjei','Baidoo','Wiredu','Nkansah','Twum','Larbi','Coleman']
const progs = ['Minerals Engineering','Geomatic Engineering','Petroleum Engineering','Mining Engineering','Mechanical Engineering','Electrical & Electronic Eng.','Computer Science & Eng.','Renewable Energy Engineering','Geological Engineering','Environmental & Safety Eng.','Logistics & Transport Mgmt','Mathematics']
const prefixes = ['MN','GM','PE','MC','EE','CE','RN','GL','ES','MA']

const addDaysIso = (d) => new Date(Date.now() + d * 86400000).toISOString()

async function emailToId() {
  const map = new Map()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    for (const u of data?.users || []) if (u.email) map.set(u.email.toLowerCase(), u.id)
    if ((data?.users || []).length < 200) break
  }
  return map
}

async function seed() {
  const existing = await emailToId()
  let created = 0
  let updated = 0
  for (let i = 0; i < COUNT; i++) {
    const n = String(i + 1).padStart(2, '0')
    const email = `student${n}@${DOMAIN}`
    const annual = i % 4 === 0
    const user_metadata = {
      full_name: `${firsts[i % firsts.length]} ${lasts[(i * 7 + 3) % lasts.length]}`,
      student_country: 'Ghana',
      student_country_code: 'GH',
      student_university: UNIVERSITY,
      student_university_custom: false,
      student_index_number: `UMaT/${prefixes[i % prefixes.length]}/24/${String(1000 + i)}`,
      student_programme: progs[i % progs.length],
      student_verified_at: addDaysIso(-3),
    }
    const app_metadata = {
      scmpedia_subscription: {
        tier: 'premium',
        plan: annual ? 'student-annual' : 'student-monthly',
        paystack_reference: `seed-${n}`,
        expires_at: addDaysIso(annual ? 366 : 200),
        updated_at: addDaysIso(-2),
      },
    }
    const id = existing.get(email)
    if (id) {
      const { error } = await admin.auth.admin.updateUserById(id, { user_metadata, app_metadata })
      if (error) console.error(`update ${email}: ${error.message}`)
      else updated++
    } else {
      const { error } = await admin.auth.admin.createUser({
        email,
        password: `Test!${Math.abs((i * 2654435761) % 1e9)}aZ`,
        email_confirm: true,
        user_metadata,
        app_metadata,
      })
      if (error) console.error(`create ${email}: ${error.message}`)
      else created++
    }
  }
  console.log(`Seeded ${UNIVERSITY}: ${created} created, ${updated} updated (of ${COUNT}).`)
}

async function clean() {
  const map = await emailToId()
  let removed = 0
  for (const [email, id] of map) {
    if (!email.endsWith(`@${DOMAIN}`)) continue
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) console.error(`delete ${email}: ${error.message}`)
    else removed++
  }
  console.log(`Removed ${removed} @${DOMAIN} test students.`)
}

const mode = process.argv[2]
if (mode === 'seed') await seed()
else if (mode === 'clean') await clean()
else {
  console.error('Usage: node scripts/raffle-test-students.mjs <seed|clean>')
  process.exit(1)
}
