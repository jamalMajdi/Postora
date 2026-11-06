import { useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { Icon, TOOLBAR_ICONS } from '../ui/icons.jsx';

/**
 * محرر Markdown مع شريط أدوات.
 *
 * شريط الأدوات يلفّ التحديد الحالي بعلامات Markdown (سلوك متوقع للمستخدم).
 * الأيقونات من Lucide — لا إيموجي. كل زر له aria-label وعنوان نصّي.
 */
export function MarkdownEditor({ value, onChange, placeholder, disabled }) {
  const { t } = useApp();
  const textareaRef = useRef(null);

  const wrapSelection = (before, after = before) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;

    onChange(next);

    // إعادة التحديد بعد التحديث (داخل مهمة أخرى لضمان تطبيق القيمة)
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const prefixLine = (prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
    onChange(next);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };

  const tools = [
    { key: 'bold', title: t('editor.toolbar.bold'), action: () => wrapSelection('**') },
    { key: 'italic', title: t('editor.toolbar.italic'), action: () => wrapSelection('*') },
    { key: 'strike', title: t('editor.toolbar.strike'), action: () => wrapSelection('~~') },
    { key: 'code', title: t('editor.toolbar.code'), action: () => wrapSelection('`') },
    { key: 'separator-1', separator: true },
    { key: 'h1', title: t('editor.toolbar.h1'), action: () => prefixLine('# ') },
    { key: 'h2', title: t('editor.toolbar.h2'), action: () => prefixLine('## ') },
    { key: 'quote', title: t('editor.toolbar.quote'), action: () => prefixLine('> ') },
    { key: 'separator-2', separator: true },
    { key: 'list', title: t('editor.toolbar.list'), action: () => prefixLine('- ') },
    { key: 'orderedList', title: t('editor.toolbar.orderedList'), action: () => prefixLine('1. ') },
    { key: 'link', title: t('editor.toolbar.link'), action: () => wrapSelection('[', '](https://)') },
    {
      key: 'codeBlock',
      title: t('editor.toolbar.codeBlock'),
      action: () => wrapSelection('\n```\n', '\n```\n')
    }
  ];

  return (
    <div className="stack" style={{ gap: 'var(--ds-space-2)' }}>
      <div className="toolbar" role="toolbar" aria-label={t('editor.title')}>
        {tools.map((tool) =>
          tool.separator ? (
            <span key={tool.key} className="toolbar__sep" aria-hidden="true" />
          ) : (
            <button
              key={tool.key}
              type="button"
              className="toolbar__btn"
              title={tool.title}
              aria-label={tool.title}
              data-tool={tool.key}
              onClick={tool.action}
              disabled={disabled}
            >
              <Icon icon={TOOLBAR_ICONS[tool.key]} size={16} strokeWidth={2.1} />
            </button>
          )
        )}
      </div>

      <textarea
        ref={textareaRef}
        className="editor-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? t('editor.placeholder')}
        disabled={disabled}
        spellCheck="false"
        dir="auto"
        aria-label={t('editor.markdown')}
      />
    </div>
  );
}
