import assert from 'node:assert/strict';
import test from 'node:test';
import { getMessageChatId, getMessageSenderId } from '../src/modules/whatsapp/messageContext.js';

test('uses the group recipient as the chat for a message sent by the bot account', () => {
  assert.equal(getMessageChatId({
    from: '34600112233@c.us',
    to: '120363012345678901@g.us',
    fromMe: true
  }), '120363012345678901@g.us');
});

test('uses the sender group as the chat for a message received from another member', () => {
  assert.equal(getMessageChatId({
    from: '120363012345678901@g.us',
    to: '34600112233@c.us',
    fromMe: false
  }), '120363012345678901@g.us');
});

test('identifies the linked account as the sender of its own group command', () => {
  assert.equal(getMessageSenderId({
    from: '34600112233@c.us',
    author: '34600112233@c.us',
    fromMe: true
  }, '34600112233@c.us'), '34600112233@c.us');
});

test('uses the group author as the sender of another member command', () => {
  assert.equal(getMessageSenderId({
    from: '120363012345678901@g.us',
    author: '34600999888@c.us',
    fromMe: false
  }, '34600112233@c.us'), '34600999888@c.us');
});
