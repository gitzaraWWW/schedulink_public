update chat_conversations
set title = '새 대화'
where title = 'New chat';

alter table chat_conversations
  alter column title set default '새 대화'::text;
