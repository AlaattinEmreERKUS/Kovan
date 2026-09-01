export interface User {
  id: string;
  username: string;
  displayName: string;
}

export interface Message {
  id: number;
  authorId: string;
  content: string;
  createdAt: number;
}

export interface ReactionState {
  messageId: number;
  emoji: string;
  userIds: string[];
}

export type ClientEvent =
  | { t: "msg.send"; content: string; localId: string }
  | { t: "reaction.toggle"; messageId: number; emoji: string }
  | { t: "typing" }
  | { t: "sync"; lastMessageId: number };

export type ServerEvent =
  | { t: "hello"; me: User; members: User[]; recentMessages: Message[]; reactions: ReactionState[]; online: string[] }
  | { t: "msg.new"; message: Message; localId?: string }
  | { t: "reaction.update"; messageId: number; emoji: string; userIds: string[] }
  | { t: "presence.update"; userId: string; online: boolean }
  | { t: "typing"; userId: string }
  | { t: "sync.result"; messages: Message[] }
  | { t: "error"; code: string; message: string };
