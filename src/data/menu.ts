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
  /** Short description under the dish name (Arabic). */
  descAr?: string
  /** Short description under the dish name (English). */
  descEn?: string
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
        descAr:
          'بيتزا إيطالية أصيلة على الطريقة النابولية بعجينة حرفية تقليدية بنقاط مميزة تشبه جلد الفهد. مغطاة بصلصة الطماطم الإيطالية الغنية وجبن الموزاريلا فيور دي لاتي الذائب ودجاج متبّل شهي، وتُزيَّن بخيط من صلصة الشيف الخاصة.',
        descEn:
          'Authentic Italian Neapolitan-style pizza crafted with a traditional leopard-spotted artisan crust. Topped with rich Italian tomato sauce, melted mozzarella fior di latte, savory seasoned chicken, and finished with a chef’s signature sauce drizzle.',
        prices: [
          { label: 'صغير', labelEn: 'Small', value: 29 },
          { label: 'كبير', labelEn: 'Large', value: 37 },
        ],
      },
      {
        arName: 'بيتزا ببروني',
        enName: 'Pepperoni Pizza',
        img: '/menu/pepperoni-pizza.jpg',
        descAr:
          'بيتزا نابوليتانية مخبوزة على الحطب بصلصة طماطم غنية وجبن موزاريلا ذائب وشرائح ببروني لحم بقري مقرمشة.',
        descEn:
          'Wood-fired Neapolitan pizza topped with rich tomato sauce, melted mozzarella cheese, and crispy beef pepperoni slices.',
        prices: [
          { label: 'صغير', labelEn: 'Small', value: 29 },
          { label: 'كبير', labelEn: 'Large', value: 37 },
        ],
      },
      {
        arName: 'بيتزا ترفل',
        enName: 'Truffle Pizza',
        img: '/menu/truffle-pizza.jpg',
        descAr:
          'بيتزا نابوليتانية مخبوزة على الحطب بقاعدة صلصة بيضاء كريمية وجبن موزاريلا ذائب وشرائح فطر طازج.',
        descEn:
          'Wood-fired Neapolitan pizza with a creamy white sauce base, melted mozzarella cheese, and sliced fresh mushrooms.',
        prices: [
          { label: 'صغير', labelEn: 'Small', value: 29 },
          { label: 'كبير', labelEn: 'Large', value: 37 },
        ],
      },
      {
        arName: 'بيتزا الخضار',
        enName: 'Vegetables Pizza',
        img: '/menu/veg-pizza.jpg',
        descAr:
          'بيتزا نابوليتانية مخبوزة على الحطب بصلصة طماطم غنية وجبن موزاريلا ذائب وشرائح فلفل ملوّن وأعشاب طازجة.',
        descEn:
          'Wood-fired Neapolitan pizza topped with rich tomato sauce, melted mozzarella cheese, sliced bell peppers, and fresh herbs.',
        prices: [
          { label: 'صغير', labelEn: 'Small', value: 25 },
          { label: 'كبير', labelEn: 'Large', value: 33 },
        ],
      },
      {
        arName: 'بيتزا مارغريتا',
        enName: 'Margherita Pizza',
        img: '/menu/margherita-pizza.jpg',
        descAr:
          'بيتزا نابوليتانية كلاسيكية مخبوزة على الحطب بصلصة طماطم غنية وموزاريلا طازجة ذائبة وزيت زيتون بكر ممتاز وأوراق ريحان طازجة.',
        descEn:
          'Classic wood-fired Neapolitan pizza topped with rich tomato sauce, melted fresh mozzarella, extra virgin olive oil, and fresh basil leaves.',
        prices: [
          { label: 'صغير', labelEn: 'Small', value: 25 },
          { label: 'كبير', labelEn: 'Large', value: 33 },
        ],
      },
      {
        arName: 'بيتزا البيانكا بالدجاج',
        enName: 'Bianca Chicken Pizza',
        img: '/menu/bianca-chicken-pizza.jpg',
        descAr:
          'بيتزا نابوليتانية مخبوزة على الحطب بقاعدة صلصة بيضاء كريمية وجبن موزاريلا ذائب ومكعبات دجاج متبّلة ورذاذ من زيت الزيتون.',
        descEn:
          'Wood-fired Neapolitan pizza topped with a creamy white sauce base, melted mozzarella cheese, seasoned chicken cubes, and a drizzle of olive oil.',
        prices: [
          { label: 'صغير', labelEn: 'Small', value: 29 },
          { label: 'كبير', labelEn: 'Large', value: 37 },
        ],
      },
      {
      arName: 'بيتزا نصف ونصف',
      enName: 'Half & Half Pizza',
      img: '/menu/bari-pizza.jpg',
      descAr: 'اختر نصفين من البيتزا المفضلة لديك في بيتزا واحدة!',
      descEn: 'Choose two halves of your favorite pizzas in one pie!',
      prices: [
        { label: 'صغير', labelEn: 'Small', value: 29 },
        { label: 'كبير', labelEn: 'Large', value: 37 },
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
        descAr:
          'سباغيتي كلاسيكية بصلصة الطماطم واللحم المفروم الغنية، تعلوها قطع دجاج مشوي وجبن بارميزان وأوراق ريحان طازجة.',
        descEn:
          'Classic spaghetti tossed in a rich tomato and minced meat sauce, topped with grilled chicken, parmesan cheese, and fresh basil leaves.',
        prices: [{ value: 29, suffix: 'SR', single: true }],
      },
      {
        arName: 'مكرونة بيني بالدجاج - صلصة مُخلوطة',
        enName: 'Penne Pasta With Chicken | Mixed Sauce',
        img: DRIVE('1SWvuYCQ_Xvw1xv2SKO0YU6EMiybv51Is'),
        descAr:
          'معكرونة بيني بصلصة مارينارا غنية، تعلوها مكعبات دجاج مشوي وجبن بارميزان وأوراق ريحان طازجة.',
        descEn:
          'Penne pasta tossed in a rich marinara sauce, topped with grilled chicken cubes, parmesan cheese, and fresh basil leaves.',
        prices: [{ value: 29, suffix: 'SR', single: true }],
      },
      {
        arName: 'تلياتيلي بالدجاج - صلصة بيضاء',
        enName: 'Tagliatelle Pasta With Chicken | White Sauce',
        img: DRIVE('1ehnFOkgvrmPmETfYZRsc4dDAcj6sNeek'),
        descAr:
          'معكرونة فيتوتشيني بصلصة الفطر الكريمية، تُقدَّم مع مكعبات دجاج مشوي وجبن بارميزان وأوراق ريحان طازجة.',
        descEn:
          'Fettuccine pasta tossed in a creamy mushroom sauce, served with grilled chicken cubes, parmesan, and fresh basil leaves.',
        prices: [{ value: 29, suffix: 'SR', single: true }],
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
        descAr: 'بطاطس مقلية ذهبية، مقرمشة من الخارج وطرية من الداخل.',
        descEn: 'Golden crispy french fries, crispy on the outside and tender on the inside.',
        prices: [{ value: 11, suffix: 'SR', single: true }],
      },
      {
        arName: 'سلطة شمندر',
        enName: 'Beetroot Salad',
        img: DRIVE('14JjJ4J8uJNL_sTevlUjPaeUUgmnULRow'),
        descAr:
          'مزيج شهي من مكعبات الشمندر الطري والجرجير اللاذع وجبن مفتت ومكسرات مجروشة، تُزيَّن بخيط من الصوص الكريمي الخاص.',
        descEn:
          'A delicious mix of tender beetroot cubes, peppery arugula, crumbled cheese, and crushed nuts, finished with a signature creamy drizzle.',
        prices: [{ value: 17, suffix: 'SR', single: true }],
      },
      {
        arName: 'سلطة الخوخ',
        enName: 'Peach Salad',
        img: DRIVE('1dEc1va0mYbC_ycgUk0J3PPxVK5E1LNiD'),
        descAr:
          'شرائح خوخ طازجة فوق خس روماني مقرمش وجرجير بري، تعلوها جبن بارميزان وصلصتنا الكريمية الخاصة.',
        descEn:
          'Fresh sliced peaches over crisp Romaine lettuce and wild arugula, topped with parmesan cheese and our creamy house dressing.',
        prices: [{ value: 17, suffix: 'SR', single: true }],
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
    { ar: 'عصير ليمون', en: 'Lemonade', img: '/menu/lemonade.jpg', price: 9 },
    { ar: 'كولا', en: 'Cola', img: '/menu/cola.jpg', price: 4 },
    { ar: 'سبرايت', en: 'Sprite', img: '/menu/sprite.jpg', price: 4 },
    { ar: 'ماء', en: 'Water', img: '/menu/water.jpg', price: 2 },
],
}
]

export const LOYALTY_URL = '/#loyalty'
export const STAFF_URL = '/#/staff'

export function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
