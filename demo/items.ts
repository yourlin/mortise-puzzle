export interface DemoItem {
  readonly no: number;
  readonly file: string;
  readonly zh: string;
  readonly en: string;
}

/** demo 用的羊毛毡风格小场景，顺序与 img/ 下的文件名前缀一致 */
export const ITEMS: readonly DemoItem[] = [
  { no: 1, file: '01-bear-picnic.png', zh: '小熊野餐', en: "Bear's Picnic" },
  { no: 2, file: '02-kitten-bakery.png', zh: '小猫面包店', en: 'Kitten Bakery' },
  { no: 3, file: '03-bunny-garden.png', zh: '兔子浇花', en: "Bunny's Garden" },
  { no: 4, file: '04-penguin-ice-cream.png', zh: '企鹅冰淇淋车', en: 'Penguin Ice Cream' },
  { no: 5, file: '05-fox-camping.png', zh: '狐狸露营', en: 'Fox Camping' },
  { no: 6, file: '06-panda-boba.png', zh: '熊猫奶茶铺', en: 'Panda Boba' },
  { no: 7, file: '07-duckling-rain.png', zh: '小鸭戏雨', en: 'Duckling in the Rain' },
  { no: 8, file: '08-hamster-reading.png', zh: '仓鼠读书', en: 'Hamster Reading' },
  { no: 9, file: '09-koala-space.png', zh: '考拉漫游太空', en: 'Koala in Space' },
  { no: 10, file: '10-capybara-onsen.png', zh: '水豚泡温泉', en: 'Capybara Onsen' },
];

export const imgSrc = (item: DemoItem) => `img/${item.file}`;
