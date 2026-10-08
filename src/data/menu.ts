// SPDX-License-Identifier: Apache-2.0
/** The Italiano Bari menu, exactly as published on the live site. */

export interface MenuPrice {
  label?: string
  /** English label shown when the site is switched to English. */
  labelEn?: string
  old?: number
  value: number
  suffix?: string
  /** single = tomato pill, variant = basil pill (two sizes) */
  single?: boolean
}

export interface MenuItem {
  arName: string
  enName: string
  img: string
  badge?: string
  note?: string
  /** English note shown when the site is switched to English. */
  noteEn?: string
  prices: MenuPrice[]
}

export interface MenuSection {
  id: string
  chip: string
  /** English chip shown when the site is switched to English. */
  chipEn: string
  ar: string
  en: string
  items?: MenuItem[]
  drinks?: { ar: string; en: string; price: number }[]
}

const DRIVE = (id: string) => `https://drive.google.com/thumbnail?id=${id}&sz=w1200`

export const SECTIONS: MenuSection[] = [
  {
    id: 'pizza',
    chip: '🍕 بيتزا',
    chipEn: '🍕 Pizza',
    ar: 'البيتزا',
    en: 'Pizza',
    items: [
      {
        arName: 'باري بيتزا',
        enName: 'Bari Pizza',
        img: '/menu/bari-pizza.jpg',
        badge: 'new special',
        note: 'حار / غير حار',
        noteEn: 'Spicy / Mild',
        prices: [
          { label: 'صغير', labelEn: 'Small', old: 35, value: 29 },
          { label: 'كبير', labelEn: 'Large', old: 45, value: 37 },
        ],
      },
      {
        arName: 'بيتزا ببروني',
        enName: 'Pepperoni Pizza',
        img: '/menu/pepperoni-pizza.jpg',
        prices: [
          { label: 'صغير', labelEn: 'Small', old: 35, value: 29 },
          { label: 'كبير', labelEn: 'Large', old: 43, value: 37 },
        ],
      },
      {
        arName: 'بيتزا ترفل',
        enName: 'Truffle Pizza',
        img: '/menu/truffle-pizza.jpg',
        prices: [
          { label: 'صغير', labelEn: 'Small', old: 35, value: 29 },
          { label: 'كبير', labelEn: 'Large', old: 45, value: 37 },
        ],
      },
      {
        arName: 'بيتزا الخضار',
        enName: 'Vegetables Pizza',
        img: '/menu/veg-pizza.jpg',
        prices: [
          { label: 'صغير', labelEn: 'Small', old: 29, value: 25 },
          { label: 'كبير', labelEn: 'Large', old: 43, value: 33 },
        ],
      },
      {
        arName: 'بيتزا مارغريتا',
        enName: 'Margherita Pizza',
        img: '/menu/margherita-pizza.jpg',
        prices: [
          { label: 'صغير', labelEn: 'Small', old: 29, value: 25 },
          { label: 'كبير', labelEn: 'Large', old: 39, value: 33 },
        ],
      },
      {
        arName: 'بيتزا البيانكا بالدجاج',
        enName: 'Bianca Chicken Pizza',
        img: '/menu/bianca-chicken-pizza.jpg',
        prices: [
          { label: 'صغير', labelEn: 'Small', old: 35, value: 29 },
          { label: 'كبير', labelEn: 'Large', old: 45, value: 37 },
        ],
      },
    ],
  },
  {
    id: 'pasta',
    chip: '🍝 باستا',
    chipEn: '🍝 Pasta',
    ar: 'الباستا',
    en: 'Pasta',
    items: [
      {
        arName: 'مكرونة سباغيتي بالدجاج - صلصه حمراء',
        enName: 'Spaghetti Pasta | Red Sauce',
        img: DRIVE('1hhqxGSjQxKypADfKqMFnbUUZ_4X5Oz6U'),
        prices: [{ old: 35, value: 29, suffix: 'SR', single: true }],
      },
      {
        arName: 'مكرونة بيني بالدجاج - صلصة مُخلوطة',
        enName: 'Penne Pasta With Chicken | Mixed Sauce',
        img: DRIVE('1SWvuYCQ_Xvw1xv2SKO0YU6EMiybv51Is'),
        prices: [{ old: 35, value: 29, suffix: 'SR', single: true }],
      },
      {
        arName: 'تلياتيلي بالدجاج - صلصة بيضاء',
        enName: 'Tagliatelle Pasta With Chicken | White Sauce',
        img: DRIVE('1ehnFOkgvrmPmETfYZRsc4dDAcj6sNeek'),
        prices: [{ old: 35, value: 29, suffix: 'SR', single: true }],
      },
    ],
  },
  {
    id: 'salad',
    chip: '🥗 سلطات',
    chipEn: '🥗 Salads',
    ar: 'السلطات',
    en: 'Salad',
    items: [
      {
        arName: 'البطاطس',
        enName: 'Fries',
        img: '/menu/fries.jpg',
        prices: [{ value: 11, suffix: 'SR', single: true }],
      },
      {
        arName: 'سلطة شمندر',
        enName: 'Beetroot Salad',
        img: DRIVE('14JjJ4J8uJNL_sTevlUjPaeUUgmnULRow'),
        prices: [{ old: 21, value: 17, suffix: 'SR', single: true }],
      },
      {
        arName: 'سلطة الخوخ',
        enName: 'Peach Salad',
        img: DRIVE('1dEc1va0mYbC_ycgUk0J3PPxVK5E1LNiD'),
        prices: [{ old: 21, value: 17, suffix: 'SR', single: true }],
      },
    ],
  },
  {
    id: 'drinks',
    chip: '🥤 مشروبات',
    chipEn: '🥤 Drinks',
    ar: 'المشروبات',
    en: 'Drinks',
    drinks: [
      { ar: 'عصير ليمون', en: 'Lemon Juice', price: 9 },
      { ar: 'كولا', en: 'Cola', price: 4 },
      { ar: 'سبرايت', en: 'Sprite', price: 4 },
      { ar: 'ماء', en: 'Water', price: 2 },
    ],
  },
]

export const LOYALTY_URL = '/#loyalty'
export const STAFF_URL = '/#/staff'

export function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
