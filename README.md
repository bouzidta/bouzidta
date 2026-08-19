# JARVIS Web System

نظام ذكاء اصطناعي تفاعلي يعمل **بالكامل داخل المتصفح** (بدون خادم ذكاء اصطناعي وبدون تثبيت).

## التشغيل

افتح الملف مباشرة أو عبر خادم ثابت:

```bash
npx --yes serve -l 3000
```

ثم افتح المتصفح على المنفذ المعروض.

## الأوامر

- `help` قائمة الأدوات
- `search <كلمات>` بحث ويب في تبويب جديد
- `open <رابط>` فتح موقع
- `task add ...` / `tasks` مهام محفوظة في LocalStorage
- `note add ...` / `notes` ملاحظات محلية
- `code <وصف>` توليد كود وعرضه مع زر نسخ
- `speak <نص>` نطق عبر Web Speech API
- زر الميكروفون للاستماع (Chrome / Edge)

الواجهة: Dark Cyberpunk + Glassmorphism + دائرة حالة مركزية (Standby / Listening / Processing).
