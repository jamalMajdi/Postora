/**
 * رموز الأخطاء الموحدة بين الخادم والواجهة.
 * كل خطأ يُعرَض للمستخدم برسالة عربية/إنجليزية مبنية على الرمز، لا على نص داخلي.
 */

export const ErrorCode = Object.freeze({
  // عام
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',

  // المصادقة
  AUTH_MISSING_INIT_DATA: 'AUTH_MISSING_INIT_DATA',
  AUTH_INVALID_INIT_DATA: 'AUTH_INVALID_INIT_DATA',
  AUTH_EXPIRED_INIT_DATA: 'AUTH_EXPIRED_INIT_DATA',
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_EXPIRED_TOKEN: 'AUTH_EXPIRED_TOKEN',

  // المستخدم
  USER_BLOCKED: 'USER_BLOCKED',

  // الملفات
  FILE_INVALID_EXTENSION: 'FILE_INVALID_EXTENSION',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_EMPTY: 'FILE_EMPTY',
  FILE_INVALID_ENCODING: 'FILE_INVALID_ENCODING',
  FILE_DOWNLOAD_FAILED: 'FILE_DOWNLOAD_FAILED',
  CONTENT_TOO_LONG: 'CONTENT_TOO_LONG',

  // المحرك
  RENDER_FAILED: 'RENDER_FAILED',
  RENDER_NEEDS_REVIEW: 'RENDER_NEEDS_REVIEW',
  TOO_MANY_MESSAGES: 'TOO_MANY_MESSAGES',

  // القنوات
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  CHANNEL_NOT_OWNED: 'CHANNEL_NOT_OWNED',
  CHANNEL_ACCESS_DENIED: 'CHANNEL_ACCESS_DENIED',
  CHANNEL_BOT_NOT_ADMIN: 'CHANNEL_BOT_NOT_ADMIN',
  CHANNEL_BOT_CANNOT_POST: 'CHANNEL_BOT_CANNOT_POST',
  CHANNEL_INVALID_TYPE: 'CHANNEL_INVALID_TYPE',

  // النشر
  PUBLICATION_NOT_FOUND: 'PUBLICATION_NOT_FOUND',
  PUBLICATION_NOT_PENDING: 'PUBLICATION_NOT_PENDING',
  PUBLICATION_ALREADY_PROCESSED: 'PUBLICATION_ALREADY_PROCESSED',
  PUBLICATION_DUPLICATE_WARNING: 'PUBLICATION_DUPLICATE_WARNING',
  PUBLISH_FAILED: 'PUBLISH_FAILED',
  TELEGRAM_RATE_LIMITED: 'TELEGRAM_RATE_LIMITED',
  TELEGRAM_FORBIDDEN: 'TELEGRAM_FORBIDDEN',

  // حد المعدل
  RATE_LIMITED: 'RATE_LIMITED'
});

/** رسائل عربية جاهزة لعرضها للمستخدم حسب رمز الخطأ. */
export const ErrorMessagesAr = Object.freeze({
  [ErrorCode.VALIDATION_ERROR]: 'البيانات المرسلة غير صحيحة.',
  [ErrorCode.INTERNAL_ERROR]: 'حدث خطأ داخلي. حاول مرة أخرى بعد قليل.',
  [ErrorCode.NOT_FOUND]: 'العنصر المطلوب غير موجود.',
  [ErrorCode.AUTH_MISSING_INIT_DATA]: 'يجب فتح التطبيق من داخل تلجرام.',
  [ErrorCode.AUTH_INVALID_INIT_DATA]: 'تعذّر التحقق من بيانات تلجرام.',
  [ErrorCode.AUTH_EXPIRED_INIT_DATA]: 'انتهت صلاحية الجلسة. أعد فتح التطبيق.',
  [ErrorCode.AUTH_INVALID_TOKEN]: 'جلسة غير صالحة. أعد فتح التطبيق.',
  [ErrorCode.AUTH_EXPIRED_TOKEN]: 'انتهت الجلسة. أعد فتح التطبيق.',
  [ErrorCode.USER_BLOCKED]: 'هذا الحساب محظور من استخدام الخدمة.',
  [ErrorCode.FILE_INVALID_EXTENSION]: 'الامتداد غير مدعوم. أرسل ملفًا بصيغة ‎.md‎.',
  [ErrorCode.FILE_TOO_LARGE]: 'حجم الملف أكبر من الحد المسموح.',
  [ErrorCode.FILE_EMPTY]: 'الملف فارغ أو لا يحتوي نصًا.',
  [ErrorCode.FILE_INVALID_ENCODING]: 'تعذّر قراءة الملف. تأكد أنه نص UTF-8.',
  [ErrorCode.FILE_DOWNLOAD_FAILED]: 'تعذّر تنزيل الملف من تلجرام.',
  [ErrorCode.CONTENT_TOO_LONG]: 'المحتوى أطول من الحد المسموح.',
  [ErrorCode.RENDER_FAILED]: 'تعذّر تحويل المحتوى إلى تنسيق تلجرام.',
  [ErrorCode.RENDER_NEEDS_REVIEW]:
    'المحتوى يحتوي على كتلة واحدة أطول من الحد المسموح لتلجرام ولا يمكن تقسيمها بأمان. قسّمها يدويًا ثم أعد المحاولة.',
  [ErrorCode.TOO_MANY_MESSAGES]: 'المحتوى طويل جدًا وسيتطلب رسائل أكثر من الحد المسموح.',
  [ErrorCode.CHANNEL_NOT_FOUND]: 'القناة غير موجودة أو أن البوت ليس عضوًا فيها.',
  [ErrorCode.CHANNEL_NOT_OWNED]: 'لا تملك صلاحية إدارة هذه القناة.',
  [ErrorCode.CHANNEL_ACCESS_DENIED]: 'لا تملك صلاحية النشر في هذه القناة.',
  [ErrorCode.CHANNEL_BOT_NOT_ADMIN]: 'البوت ليس مسؤولًا في القناة. أضفه كمسؤول ثم أعد المحاولة.',
  [ErrorCode.CHANNEL_BOT_CANNOT_POST]: 'البوت مسؤول لكنه لا يملك صلاحية "نشر الرسائل" في القناة.',
  [ErrorCode.CHANNEL_INVALID_TYPE]: 'هذا النوع من المحادثات غير مدعوم. اختر قناة.',
  [ErrorCode.PUBLICATION_NOT_FOUND]: 'طلب النشر غير موجود.',
  [ErrorCode.PUBLICATION_NOT_PENDING]: 'طلب النشر لم يعد في حالة انتظار.',
  [ErrorCode.PUBLICATION_ALREADY_PROCESSED]: 'تمت معالجة طلب النشر بالفعل.',
  [ErrorCode.PUBLICATION_DUPLICATE_WARNING]:
    'نشرت هذا المحتوى نفسه في هذه القناة قبل قليل. أعد المحاولة مع تأكيد النشر المكرر إن كنت متأكدًا.',
  [ErrorCode.PUBLISH_FAILED]: 'فشل النشر في تلجرام.',
  [ErrorCode.TELEGRAM_RATE_LIMITED]: 'تلجرام يحدّ من عدد الطلبات حاليًا. حاول بعد قليل.',
  [ErrorCode.TELEGRAM_FORBIDDEN]: 'تلجرام رفض العملية بسبب الصلاحيات.',
  [ErrorCode.RATE_LIMITED]: 'عدد الطلبات كبير. انتظر قليلًا ثم أعد المحاولة.'
});

/** رسائل إنجليزية لعرضها للمستخدم حسب رمز الخطأ. */
export const ErrorMessagesEn = Object.freeze({
  [ErrorCode.VALIDATION_ERROR]: 'The submitted data is invalid.',
  [ErrorCode.INTERNAL_ERROR]: 'An internal error occurred. Please try again shortly.',
  [ErrorCode.NOT_FOUND]: 'The requested item was not found.',
  [ErrorCode.AUTH_MISSING_INIT_DATA]: 'Please open this app from inside Telegram.',
  [ErrorCode.AUTH_INVALID_INIT_DATA]: 'Could not verify Telegram data.',
  [ErrorCode.AUTH_EXPIRED_INIT_DATA]: 'Session expired. Please reopen the app.',
  [ErrorCode.AUTH_INVALID_TOKEN]: 'Invalid session. Please reopen the app.',
  [ErrorCode.AUTH_EXPIRED_TOKEN]: 'Session expired. Please reopen the app.',
  [ErrorCode.USER_BLOCKED]: 'This account is blocked from using the service.',
  [ErrorCode.FILE_INVALID_EXTENSION]: 'Unsupported file type. Please send a .md file.',
  [ErrorCode.FILE_TOO_LARGE]: 'The file exceeds the maximum allowed size.',
  [ErrorCode.FILE_EMPTY]: 'The file is empty or contains no text.',
  [ErrorCode.FILE_INVALID_ENCODING]: 'Could not read the file. Make sure it is UTF-8 text.',
  [ErrorCode.FILE_DOWNLOAD_FAILED]: 'Could not download the file from Telegram.',
  [ErrorCode.CONTENT_TOO_LONG]: 'The content is longer than the allowed limit.',
  [ErrorCode.RENDER_FAILED]: 'Could not convert the content to Telegram formatting.',
  [ErrorCode.RENDER_NEEDS_REVIEW]:
    'The content contains a single block longer than Telegram allows and it cannot be split safely. Please split it manually and retry.',
  [ErrorCode.TOO_MANY_MESSAGES]: 'The content is too long and would require too many messages.',
  [ErrorCode.CHANNEL_NOT_FOUND]: 'Channel not found, or the bot is not a member of it.',
  [ErrorCode.CHANNEL_NOT_OWNED]: 'You do not have admin rights on this channel.',
  [ErrorCode.CHANNEL_ACCESS_DENIED]: 'You do not have permission to publish in this channel.',
  [ErrorCode.CHANNEL_BOT_NOT_ADMIN]: 'The bot is not an administrator in the channel. Add it as admin and retry.',
  [ErrorCode.CHANNEL_BOT_CANNOT_POST]: 'The bot is an admin but lacks the "Post messages" permission.',
  [ErrorCode.CHANNEL_INVALID_TYPE]: 'This chat type is not supported. Please select a channel.',
  [ErrorCode.PUBLICATION_NOT_FOUND]: 'Publish request not found.',
  [ErrorCode.PUBLICATION_NOT_PENDING]: 'The publish request is no longer pending.',
  [ErrorCode.PUBLICATION_ALREADY_PROCESSED]: 'This publish request has already been processed.',
  [ErrorCode.PUBLICATION_DUPLICATE_WARNING]:
    'You published this exact content to this channel recently. Retry with explicit duplicate confirmation if you are sure.',
  [ErrorCode.PUBLISH_FAILED]: 'Publishing to Telegram failed.',
  [ErrorCode.TELEGRAM_RATE_LIMITED]: 'Telegram is rate limiting requests. Please try again shortly.',
  [ErrorCode.TELEGRAM_FORBIDDEN]: 'Telegram rejected the operation due to permissions.',
  [ErrorCode.RATE_LIMITED]: 'Too many requests. Please wait and retry.'
});

export const ErrorMessages = Object.freeze({
  ar: ErrorMessagesAr,
  en: ErrorMessagesEn
});

/**
 * يرجّع رسالة قابلة للعرض لمستخدم نهائي.
 * @param {string} code رمز الخطأ
 * @param {'ar'|'en'} [locale]
 */
export function getUserMessage(code, locale = 'ar') {
  const table = ErrorMessages[locale] || ErrorMessagesAr;
  return table[code] || table[ErrorCode.INTERNAL_ERROR];
}
