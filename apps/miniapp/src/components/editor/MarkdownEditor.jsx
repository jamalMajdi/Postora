import { useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';

/**
 * محرر Markdown مع شريط أدوات.
 * شريط الأدوات يلفّ التحديد الحالي بعلامات Markdown (سلوك متوقع للمستخدم).
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
    { key: 'bold', label: 'B', title: t('editor.toolbar.bold'), action: () => wrapSelection('**') },
    { key: 'italic', label: 'I', title: t('editor.toolbar.italic'), action: () => wrapSelection('*') },
    { key: 'strike', label: 'S', title: t('editor.toolbar.strike'), action: () => wrapSelection('~~') },
    { key: 'code', label: '</>', title: t('editor.toolbar.code'), action: () => wrapSelection('`') },
    { key: 'link', label: '🔗', title: t('editor.toolbar.link'), action: () => wrapSelection('[', '](https://)') },
    { key: 'h1', label: 'H1', title: t('editor.toolbar.h1'), action: () => prefixLine('# ') },
    { key: 'h2', label: 'H2', title: t('editor.toolbar.h2'), action: () => prefixLine('## ') },
    { key: 'quote', label: '❝', title: t('editor.toolbar.quote'), action: () => prefixLine('> ') },
    { key: 'list', label: '•', title: t('editor.toolbar.list'), action: () => prefixLine('- ') },
    { key: 'orderedList', label: '1.', title: t('editor.toolbar.orderedList'), action: () => prefixLine('1. ') },
    { key: 'codeBlock', label: '{ }', title: t('editor.toolbar.codeBlock'), action: () => wrapSelection('\n```\n', '\n```\n') }
  ];

  return (
    <div className="stack" style={{ gap: 'var(--space-2)' }}>
      <div className="toolbar" role="toolbar" aria-label={t('editor.title')}>
        {tools.map((tool) => (
          <button
            key={tool.key}
            type="button"
            className="toolbar__btn"
            title={tool.title}
            aria-label={tool.title}
            onClick={tool.action}
            disabled={disabled}
          >
            {tool.label}
          </button>
        ))}
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
