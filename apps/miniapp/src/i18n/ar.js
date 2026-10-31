/** الترجمة العربية (اللغة الافتراضية + RTL). */
export default {
  app: {
    name: 'Postora',
    tagline: 'اكتب بـ Markdown وانشر في تلجرام'
  },
  nav: {
    home: 'الرئيسية',
    editor: 'المحرر',
    drafts: 'المسودات',
    publications: 'المنشورات',
    channels: 'القنوات'
  },
  common: {
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
    saved: 'تم الحفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    confirm: 'تأكيد',
    close: 'إغلاق',
    retry: 'إعادة المحاولة',
    loading: 'جارٍ التحميل…',
    empty: 'لا يوجد شيء بعد',
    back: 'رجوع',
    yes: 'نعم',
    no: 'لا',
    optional: 'اختياري',
    required: 'مطلوب',
    copy: 'نسخ',
    copied: 'تم النسخ',
    error: 'حدث خطأ',
    chars: 'حرفًا',
    messages: 'رسالة',
    publish: 'نشر',
    publishing: 'جارٍ النشر…'
  },
  dashboard: {
    title: 'لوحة التحكم',
    welcome: 'مرحبًا',
    newPost: 'مقال جديد',
    stats: {
      drafts: 'المسودات',
      channels: 'القنوات',
      published: 'منشورات ناجحة',
      failed: 'منشورات فاشلة'
    },
    recentPublications: 'أحدث عمليات النشر',
    noPublications: 'لم تنشر أي مقال بعد.',
    quickStart: 'ابدأ بكتابة مقال، أو اربط قناة أولًا.'
  },
  editor: {
    title: 'محرر المقال',
    placeholder: 'اكتب مقالك هنا باستخدام Markdown…\n\n# عنوان\n**نص عريض** و *مائل*\n- عنصر قائمة\n[رابط](https://example.com)',
    preview: 'معاينة',
    write: 'كتابة',
    markdown: 'Markdown',
    telegramPreview: 'معاينة تلجرام',
    selectChannel: 'اختر القناة',
    noChannels: 'لا توجد قنوات مرتبطة. أضف قناة أولًا من تبويب القنوات.',
    targetChannel: 'القناة المستهدفة',
    saveDraft: 'حفظ كمسودة',
    publishNow: 'نشر الآن',
    stats: 'إحصاءات',
    messagesCount: 'عدد الرسائل',
    totalChars: 'إجمالي المحارف',
    warnings: 'تنبيهات التنسيق',
    noWarnings: 'لا توجد تنبيهات — كل التنسيقات مدعومة.',
    publishSuccess: 'تم النشر بنجاح',
    titlePlaceholder: 'عنوان المسودة (اختياري)',
    toolbar: {
      bold: 'عريض',
      italic: 'مائل',
      strike: 'مشطوب',
      code: 'كود',
      link: 'رابط',
      h1: 'عنوان 1',
      h2: 'عنوان 2',
      quote: 'اقتباس',
      list: 'قائمة',
      orderedList: 'قائمة مرقمة',
      codeBlock: 'كتلة كود'
    }
  },
  publications: {
    title: 'المنشورات',
    subtitle: 'كل ما نشرته — مع إمكانية الحذف من القناة',
    empty: 'لا يوجد منشورات بعد.',
    status: {
      published: 'منشور',
      failed: 'فاشل',
      pending: 'قيد الانتظار',
      publishing: 'جارٍ النشر',
      cancelled: 'ملغى',
      deleted: 'محذوف'
    },
    messages: 'رسالة',
    chars: 'حرف',
    delete: 'حذف من القناة',
    deleteConfirm: 'سيُحذف هذا المنشور من قناته على تلجرام. هل تريد المتابعة؟',
    deleting: 'جارٍ الحذف…',
    deleted: 'تم حذف المنشور من القناة',
    deletedPartial: 'حُذف جزئيًا — بعض الرسائل لم تُحذف',
    alreadyDeleted: 'المنشور محذوف بالفعل',
    cannotDelete: 'لا يمكن حذف هذا المنشور',
    loadMore: 'تحميل المزيد',
    publishedAt: 'تاريخ النشر',
    openChannel: 'فتح القناة'
  },

  drafts: {
    title: 'المسودات',
    empty: 'لا توجد مسودات. ابدأ بمقال جديد.',
    updatedAt: 'آخر تحديث',
    open: 'فتح',
    deleteConfirm: 'هل تريد حذف هذه المسودة نهائيًا؟',
    untitled: 'بدون عنوان'
  },
  channels: {
    title: 'القنوات',
    empty: 'لم تربط أي قناة بعد.',
    add: 'إضافة قناة',
    addTitle: 'ربط قناة جديدة',
    chatRefLabel: 'معرّف القناة',
    chatRefHint: 'مثال: @my_channel أو -1001234567890',
    addHint: 'قبل الإضافة، أضف البوت @%BOT% كمسؤول في القناة مع صلاحية "نشر الرسائل".',
    verify: 'إعادة فحص الصلاحيات',
    remove: 'فصل القناة',
    removeConfirm: 'سيتم فصل القناة من Postora (لن يتأثر محتوى القناة). هل تريد المتابعة؟',
    botCanPost: 'البوت يستطيع النشر',
    botCannotPost: 'البوت لا يستطيع النشر',
    botNotAdmin: 'البوت ليس مسؤولًا',
    connected: 'تم ربط القناة بنجاح',
    lastChecked: 'آخر فحص'
  },
  errors: {
    generic: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
    network: 'تعذّر الاتصال بالخادم. تحقق من الشبكة.',
    notInTelegram: 'افتح هذا التطبيق من داخل تلجرام لتعمل كل الوظائف.',
    nameRequired: 'أدخل معرّف القناة.'
  },
  settings: {
    title: 'الإعدادات',
    language: 'اللغة',
    arabic: 'العربية',
    english: 'English',
    account: 'الحساب',
    telegramId: 'معرّف تلجرام'
  }
};
