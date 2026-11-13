# 🚀 Ariyak Store - Telegram Mini App

កម្មវិធី Telegram Mini App សម្រាប់លក់គណនីឌីជីថល (AI & Creative Subscriptions) ជាមួយប្រព័ន្ធស្កេនទូទាត់ **KHQR Bakong** តម្លៃជាក់ស្តែងស្វ័យប្រវត្តិ។

---

## 📁 រចនាសម្ព័ន្ធឯកសារ (Project File Structure)

កូដត្រូវបានបំបែកជា File ដាច់ៗពីគ្នា ងាយស្រួលក្នុងការកែសម្រួល (Easy to Edit & Fix):

```text
ariyak_store/
│
├── index.html          # កូដរចនាសម្ព័ន្ធ HTML ទាំងមូល (Structure, Pages & Modals)
│
├── css/
│   └── style.css       # ស្ទីល Design ទាំងមូល (Dark Cyberpunk Theme, Responsive UI)
│
├── js/
│   ├── products.js     # បញ្ជីទំនិញទាំង ១៥ មុខ (Products, Plans, Prices, Features)
│   ├── i18n.js         # អក្សរភាសាខ្មែរ និងអង់គ្លេស (Khmer & English Translations)
│   ├── khqr.js         # កូដបង្កើត KHQR Bakong តម្លៃជាក់ស្តែង (EMVCo CRC-16)
│   └── app.js          # Logic ដំណើរការ App (State, Filters, Orders, Modals, Telegram SDK)
│
└── README.md           # ការណែនាំអំពីគម្រោង
```

---

## 🛠️ របៀបកែប្រែកូដតាមតម្រូវការ (How to Edit)

| អ្វីដែលអ្នកចង់កែ (What to edit) | ឯកសារត្រូវកែ (Target File) |
|---|---|
| **បន្ថែម ឬកែតម្លៃផលិតផល** (Add/Edit Products, Prices, Plans) | `js/products.js` |
| **កែអក្សរភាសាខ្មែរ / English** (Translations & Text) | `js/i18n.js` |
| **កែសម្រួលគណនី Bakong ឬប្រព័ន្ធ KHQR** (Payment Engine) | `js/khqr.js` |
| **កែមុខងារបញ្ជាទិញ ប៊ូតុង និងទំព័រ** (App Logic & Features) | `js/app.js` |
| **កែពណ៌ Theme ទំហំ Font និងរូបរាង** (Styling & Design) | `css/style.css` |
| **កែ Layout ឬទម្រង់ទំព័រ HTML** (HTML Layout) | `index.html` |

---

## 💡 របៀបបើកដំណើរការ (How to Run)
1. ចម្លង Folder `ariyak_store` ទៅកាន់ទីតាំងណាមួយលើកុំព្យូទ័ររបស់អ្នក
2. ចុចពីរដង (Double-click) លើ `index.html` ដើម្បីបើកមើលលើ Chrome, Edge ឬ Browser ណាក៏បានភ្លាមៗ!
