let activeConversationId: string | null = null;

export function setActiveChatConversation(conversationId: string | null) {
  activeConversationId = conversationId;
}

export function getActiveChatConversation(): string | null {
  return activeConversationId;
}

export function dispatchChatUnreadChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('chatUnreadChanged'));
  }
}
