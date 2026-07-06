export const palette = {
  green: '#006253',
  greenSoft: '#E6F4EF',
  orange: '#FF781F',
  orangeSoft: '#FFF0E2',
  ink: '#17211F',
  muted: '#65736F',
  line: '#DDE7E4',
  bg: '#F7FAF9',
  card: '#FFFFFF',
  darkBg: '#101715',
  darkCard: '#17201D',
  darkLine: '#2B3935',
  darkText: '#F3F7F5',
  darkMuted: '#AEBAB6',
  danger: '#DC2626',
  blue: '#2563EB',
}

export type AppColors = ReturnType<typeof colorsFor>

export const colorsFor = (dark: boolean) => ({
  bg: dark ? palette.darkBg : palette.bg,
  card: dark ? palette.darkCard : palette.card,
  cardAlt: dark ? '#1D2825' : '#F0F6F4',
  text: dark ? palette.darkText : palette.ink,
  muted: dark ? palette.darkMuted : palette.muted,
  line: dark ? palette.darkLine : palette.line,
  primary: palette.green,
  primarySoft: dark ? '#17392F' : palette.greenSoft,
  orange: palette.orange,
  orangeSoft: dark ? '#3A271C' : palette.orangeSoft,
  danger: palette.danger,
  blue: palette.blue,
  input: dark ? '#111A17' : '#FFFFFF',
})
