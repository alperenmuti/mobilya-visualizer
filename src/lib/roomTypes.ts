export const ROOM_TYPES = [
  { id: '',         label: 'Otomatik',      en: '' },
  { id: 'salon',    label: 'Salon',         en: 'living room' },
  { id: 'yatak',    label: 'Yatak Odası',   en: 'bedroom' },
  { id: 'yemek',    label: 'Yemek Odası',   en: 'dining room' },
  { id: 'calisma',  label: 'Çalışma Odası', en: 'home office / study room' },
  { id: 'banyo',    label: 'Banyo',         en: 'bathroom' },
  { id: 'mutfak',   label: 'Mutfak',        en: 'kitchen' },
  { id: 'cocuk',    label: 'Çocuk Odası',   en: "children's bedroom" },
]

export function roomTypeToEn(id: string): string {
  return ROOM_TYPES.find(r => r.id === id)?.en ?? ''
}
