/**
 * مكتبة الأيقونات الموحدة — Lucide فقط.
 *
 * لماذا ملف وسيط بدل استيراد Lucide مباشرة في كل صفحة؟
 *  - حجم الحزمة: نستورد الأيقونات المستخدمة فقط (tree-shaken) ونصدّرها من مكان واحد.
 *  - الاتساق: سماكة الخط وحجمه وضبطه البصري موحّد عبر `<Icon>`.
 *  - الاستبدال السهل: لو تغيّرت المكتبة مستقبلًا يتغيّر ملف واحد.
 *
 * قاعدة المشروع: لا Emoji في أزرار أو تنقل أو عناوين. الإيموجي مسموح فقط
 * داخل محتوى المستخدم المعروض كما هو (نص المنشور).
 */
import {
  ArrowLeft,
  ArrowRight,
  Bold,
  Calendar,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Code,
  Columns2,
  Copy,
  Download,
  Ellipsis,
  Eye,
  FileText,
  Globe,
  Heading1,
  Heading2,
  Info,
  Italic,
  Languages,
  LayoutDashboard,
  Link2,
  List,
  ListOrdered,
  Loader2,
  LogOut,
  Megaphone,
  Moon,
  Newspaper,
  Pencil,
  PenLine,
  Plus,
  Quote,
  RefreshCw,
  Rocket,
  Save,
  Scissors,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  SquareCode,
  Strikethrough,
  Sun,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  Users,
  Wand2,
  X
} from 'lucide-react';

export {
  ArrowLeft,
  ArrowRight,
  Bold,
  Calendar,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Code,
  Columns2,
  Copy,
  Download,
  Ellipsis,
  Eye,
  FileText,
  Globe,
  Heading1,
  Heading2,
  Info,
  Italic,
  Languages,
  LayoutDashboard,
  Link2,
  List,
  ListOrdered,
  Loader2,
  LogOut,
  Megaphone,
  Moon,
  Newspaper,
  Pencil,
  PenLine,
  Plus,
  Quote,
  RefreshCw,
  Rocket,
  Save,
  Scissors,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  SquareCode,
  Strikethrough,
  Sun,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  Users,
  Wand2,
  X
};

/**
 * غلاف موحّد لأيقونة.
 *
 * @param {{icon: React.ComponentType, size?: number, strokeWidth?: number,
 *          label?: string, className?: string}} props
 */
export function Icon({ icon: Component, size = 18, strokeWidth = 2, label, className = '' }) {
  if (!Component) return null;
  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      className={`ds-icon ${className}`.trim()}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  );
}

/** خريطة أيقونات التنقل — مفاتيح المسارات كما في App.jsx. */
export const NAV_ICONS = {
  home: LayoutDashboard,
  editor: PenLine,
  drafts: FileText,
  publications: Newspaper,
  channels: Megaphone
};

/** أيقونات حالات النشر. */
export const STATUS_ICONS = {
  published: CircleCheck,
  failed: CircleX,
  deleted: Trash2,
  pending: Clock,
  publishing: Loader2,
  cancelled: CircleAlert
};

/** أيقونات شريط أدوات Markdown — بترتيب واضح. */
export const TOOLBAR_ICONS = {
  bold: Bold,
  italic: Italic,
  strike: Strikethrough,
  code: Code,
  link: Link2,
  h1: Heading1,
  h2: Heading2,
  quote: Quote,
  list: List,
  orderedList: ListOrdered,
  codeBlock: SquareCode
};

/** أيقونات أنواع التنبيهات. */
export const TOAST_ICONS = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
  warning: TriangleAlert
};
