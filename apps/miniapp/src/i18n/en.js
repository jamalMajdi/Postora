/** English translation (LTR). */
export default {
  app: {
    name: 'Postora',
    tagline: 'Write in Markdown, publish to Telegram'
  },
  nav: {
    home: 'Home',
    editor: 'Editor',
    drafts: 'Drafts',
    publications: 'Posts',
    channels: 'Channels'
  },
  common: {
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    cancel: 'Cancel',
    delete: 'Delete',
    confirm: 'Confirm',
    close: 'Close',
    retry: 'Retry',
    loading: 'Loading…',
    empty: 'Nothing here yet',
    back: 'Back',
    yes: 'Yes',
    no: 'No',
    optional: 'optional',
    required: 'required',
    copy: 'Copy',
    copied: 'Copied',
    error: 'An error occurred',
    chars: 'characters',
    messages: 'messages',
    publish: 'Publish',
    publishing: 'Publishing…'
  },
  dashboard: {
    title: 'Dashboard',
    welcome: 'Welcome',
    newPost: 'New post',
    stats: {
      drafts: 'Drafts',
      channels: 'Channels',
      published: 'Published',
      failed: 'Failed'
    },
    recentPublications: 'Recent publications',
    noPublications: 'You have not published anything yet.',
    quickStart: 'Start writing a post, or connect a channel first.'
  },
  editor: {
    title: 'Article editor',
    placeholder: 'Write your article in Markdown…\n\n# Heading\n**bold** and *italic*\n- list item\n[link](https://example.com)',
    preview: 'Preview',
    write: 'Write',
    markdown: 'Markdown',
    telegramPreview: 'Telegram preview',
    selectChannel: 'Select channel',
    noChannels: 'No channels connected. Add one from the Channels tab.',
    targetChannel: 'Target channel',
    saveDraft: 'Save as draft',
    publishNow: 'Publish now',
    stats: 'Stats',
    messagesCount: 'Messages',
    totalChars: 'Total characters',
    warnings: 'Formatting notes',
    noWarnings: 'No warnings — all formatting is supported.',
    publishSuccess: 'Published successfully',
    titlePlaceholder: 'Draft title (optional)',
    toolbar: {
      bold: 'Bold',
      italic: 'Italic',
      strike: 'Strikethrough',
      code: 'Code',
      link: 'Link',
      h1: 'Heading 1',
      h2: 'Heading 2',
      quote: 'Quote',
      list: 'List',
      orderedList: 'Numbered list',
      codeBlock: 'Code block'
    }
  },
  publications: {
    title: 'Publications',
    subtitle: 'Everything you published — with the option to delete from the channel',
    empty: 'No publications yet.',
    status: {
      published: 'Published',
      failed: 'Failed',
      pending: 'Pending',
      publishing: 'Publishing',
      cancelled: 'Cancelled',
      deleted: 'Deleted'
    },
    messages: 'messages',
    chars: 'chars',
    delete: 'Delete from channel',
    deleteConfirm: 'This post will be deleted from its Telegram channel. Continue?',
    deleting: 'Deleting…',
    deleted: 'Post deleted from the channel',
    deletedPartial: 'Partially deleted — some messages were not removed',
    alreadyDeleted: 'Post is already deleted',
    cannotDelete: 'This post cannot be deleted',
    loadMore: 'Load more',
    publishedAt: 'Published at',
    openChannel: 'Open channel'
  },

  drafts: {
    title: 'Drafts',
    empty: 'No drafts yet. Start a new post.',
    updatedAt: 'Last updated',
    open: 'Open',
    deleteConfirm: 'Delete this draft permanently?',
    untitled: 'Untitled'
  },
  channels: {
    title: 'Channels',
    empty: 'You have not connected any channel yet.',
    add: 'Add channel',
    addTitle: 'Connect a new channel',
    chatRefLabel: 'Channel handle',
    chatRefHint: 'e.g. @my_channel or -1001234567890',
    addHint: 'Before adding, make @%BOT% an administrator in the channel with "Post messages" permission.',
    verify: 'Re-check permissions',
    remove: 'Disconnect',
    removeConfirm: 'The channel will be disconnected from Postora (channel content is untouched). Continue?',
    botCanPost: 'Bot can post',
    botCannotPost: 'Bot cannot post',
    botNotAdmin: 'Bot is not an admin',
    connected: 'Channel connected successfully',
    lastChecked: 'Last checked'
  },
  errors: {
    generic: 'Something went wrong. Please try again.',
    network: 'Could not reach the server. Check your connection.',
    notInTelegram: 'Open this app from inside Telegram for full functionality.',
    nameRequired: 'Enter the channel handle.'
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    arabic: 'العربية',
    english: 'English',
    account: 'Account',
    telegramId: 'Telegram ID'
  }
};
