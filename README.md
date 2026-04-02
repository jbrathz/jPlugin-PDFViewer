# jPlugin-PDFViewer

ปลั๊กอิน WordPress สำหรับแปลง PDF embed ให้ใช้ **PDF.js** แทน Built-in viewer เพื่อแก้ปัญหา `X-Frame-Options` ที่ทำให้เปิด PDF ใน Chrome/Edge ไม่ได้

## 🔧 ความต้องการ

- WordPress 5.0+
- PHP 7.4+

## 📦 วิธีติดตั้ง

1. ดาวน์โหลด/clone โฟลเดอร์ `jPlugin-PDFViewer_1.0.0`
2. คัดลอกไปที่ `/wp-content/plugins/`
3. ไปที่ WordPress Admin > Plugins > Activate

## 📁 โครงสร้างไฟล์

```
jPlugin-PDFViewer_1.0.0/
├── jPlugin-PDFViewer.php    # Main plugin file
├── assets/
│   ├── css/
│   │   └── viewer.css        # Viewer styles
│   └── js/
│       ├── pdf.min.mjs       # PDF.js library
│       ├── pdf.worker.min.mjs # PDF.js worker
│       └── viewer.mjs        # Custom viewer script
└── README.md
```

## ✨ ฟีเจอร์

- ใช้ PDF.js สำหรับแสดง PDF บนเว็บ
- แก้ปัญหา X-Frame-Options blocking
- รองรับ Chrome, Edge, Firefox, Safari
- Responsive design
- รองรับ PDF หลายหน้า

## 🔒 Security

- มี ABSPATH check ป้องกัน direct access
- ใช้ `esc_url()` สำหรับ URL escaping
- ใช้ `esc_attr()` สำหรับ HTML attributes
- เป็น frontend-only plugin (ไม่มี database operations)

## 👨‍💻 ผู้พัฒนา

- **Author:** Jirath Buraparath
- **Website:** https://www.jirath.com

## 📄 License

GPL v2 or later
