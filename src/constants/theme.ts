export const Colors = {
  primary:  '#6C47FF',
  primary2: '#8B6FFF',
  primary3: '#A991FF',
  accent:   '#FF9500',
  accent2:  '#00D084',
  accent3:  '#00B8FF',
  danger:   '#FF3B5C',
  warn:     '#FFB800',
  bg:       '#07070F',
  bg2:      '#0D0D1E',
  bg3:      '#12121E',
  bg4:      '#18182A',
  card:     '#0F0F1E',
  border:   'rgba(255,255,255,0.08)',
  border2:  'rgba(255,255,255,0.12)',
  border3:  'rgba(255,255,255,0.18)',
  text:     '#F0F0FF',
  text2:    '#A0A0C0',
  text3:    '#606080',
  text4:    '#404060',
  white:    '#FFFFFF',
  black:    '#000000',
} as const

export const Spacing = {
  xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, xxxl:32
} as const

export const BorderRadius = {
  sm:6, md:10, lg:14, xl:18, xxl:24, full:9999
} as const

export const FontSize = {
  xs:10, sm:12, md:14, lg:16, xl:18,
  xxl:22, xxxl:28, hero:36
} as const

export const Shadow = {
  sm: {
    shadowColor:'#000', shadowOffset:{width:0,height:2},
    shadowOpacity:0.15, shadowRadius:4, elevation:2,
  },
  md: {
    shadowColor:'#000', shadowOffset:{width:0,height:4},
    shadowOpacity:0.2, shadowRadius:8, elevation:4,
  },
  lg: {
    shadowColor:'#000', shadowOffset:{width:0,height:8},
    shadowOpacity:0.3, shadowRadius:16, elevation:8,
  },
  colored: (color: string) => ({
    shadowColor:color, shadowOffset:{width:0,height:4},
    shadowOpacity:0.35, shadowRadius:10, elevation:6,
  }),
} as const
