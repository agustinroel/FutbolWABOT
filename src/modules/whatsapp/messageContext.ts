import type { Message } from 'whatsapp-web.js';

export function getMessageChatId(message: Pick<Message, 'from' | 'to' | 'fromMe'>): string {
  return message.fromMe ? message.to : message.from;
}

export function getMessageSenderId(
  message: Pick<Message, 'from' | 'author' | 'fromMe'>,
  ownId: string
): string {
  return message.fromMe ? ownId : message.author ?? message.from;
}
