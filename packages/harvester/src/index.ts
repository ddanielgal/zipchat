import * as fs from "fs";
import StreamZip from "node-stream-zip";
import { z } from "zod";
import iconv from "iconv-lite";
import schema from "./schema";
import { getStash } from "@zipchat/database";

type MessageFile = {
  zipFilePath: string;
  entryName: string;
};

export default class Harvester {
  files: string[];
  messageFiles: MessageFile[] = [];
  chat: z.infer<typeof schema>;

  constructor() {
    this.files = fs.readdirSync("data");
  }

  async harvest() {
    await this.collectMessageFiles();
    const [first, ...rest] = this.messageFiles;
    const chat = await this.getChatPart(first);
    for (const file of rest) {
      const chatPart = await this.getChatPart(file);
      chat.messages.push(...chatPart.messages);
    }

    this.fixDuplicateMessages(chat);

    await getStash().$transaction(
      async (tx) => {
        const { id } = await tx.chat.create({
          data: {
            title: chat.title,
            isStillParticipant: chat.is_still_participant,
            threadPath: chat.thread_path,
            participants: {
              create: chat.participants.map((p) => ({
                name: p.name,
              })),
            },
            magicWords: {
              create: chat.magic_words.map((m) => ({
                word: m,
              })),
            },
            joinableMode: {
              create: {
                mode: chat.joinable_mode.mode,
                link: chat.joinable_mode.link,
              },
            },
            image: {
              create: {
                uri: chat.image.uri,
                creationTimestamp: chat.image.creation_timestamp,
              },
            },
          },
        });
        for (const message of chat.messages) {
          await tx.message.create({
            data: {
              Chat: { connect: { id } },
              sender: {
                connectOrCreate: {
                  where: {
                    name: message.sender_name,
                  },
                  create: {
                    name: message.sender_name,
                  },
                },
              },
              timestampMs: String(message.timestamp_ms),
              content: message.content,
              photos: {
                create: message.photos?.map((p) => ({
                  uri: p.uri,
                  creationTimestamp: p.creation_timestamp,
                })),
              },
              videos: {
                create: message.videos?.map((v) => ({
                  uri: v.uri,
                  creationTimestamp: v.creation_timestamp,
                })),
              },
              gifs: {
                create: message.gifs?.map((g) => ({
                  uri: g.uri,
                })),
              },
              files: {
                create: message.files?.map((f) => ({
                  uri: f.uri,
                  creationTimestamp: f.creation_timestamp,
                })),
              },
              audioFiles: {
                create: message.audio_files?.map((a) => ({
                  uri: a.uri,
                  creationTimestamp: a.creation_timestamp,
                })),
              },
              ...(message.sticker && {
                sticker: {
                  create: {
                    uri: message.sticker?.uri,
                  },
                },
              }),
              callDuration: message.call_duration,
              ...(message.share && {
                share: {
                  create: {
                    link: message.share?.link,
                    shareText: message.share?.share_text,
                  },
                },
              }),
              isUnsent: message.is_unsent,
              users: {
                connectOrCreate: message.users?.map((u) => ({
                  where: {
                    name: u.name,
                  },
                  create: {
                    name: u.name,
                  },
                })),
              },
              reactions: {
                create: message.reactions?.map((r) => ({
                  reaction: r.reaction,
                  actor: {
                    connectOrCreate: {
                      where: {
                        name: r.actor,
                      },
                      create: {
                        name: r.actor,
                      },
                    },
                  },
                })),
              },
            },
          });
        }
      },
      { timeout: 1000 * 60 * 60 }
    );
    return "done";
  }

  /**
   * mutates `chat`
   */
  fixDuplicateMessages(chat: z.infer<typeof schema>) {
    const checked = new Set();
    chat.messages.forEach((message, index, messages) => {
      if (checked.has(message.timestamp_ms)) {
        messages[index].timestamp_ms += 1;
      } else {
        checked.add(message.timestamp_ms);
      }
    });
    return chat;
  }

  async getChatPart(file: MessageFile) {
    const rawContent = await new StreamZip.async({
      file: file.zipFilePath,
    }).entryData(file.entryName);
    const firstParsed = JSON.parse(rawContent.toString(), (_, value) => {
      if (typeof value !== "string") return value;
      return iconv.decode(iconv.encode(value, "latin1"), "utf-8");
    });
    const chat = schema.parse(firstParsed);
    return chat;
  }

  async collectMessageFiles() {
    for (const file of this.files) {
      const filePath = `data/${file}`;
      const zip = new StreamZip.async({ file: filePath });
      const entries = await zip.entries();

      this.messageFiles.push(
        ...Object.values(entries)
          .filter((entry) => entry.name.includes(process.argv[2]))
          .filter((entry) => entry.name.endsWith(".json"))
          .map((entry) => ({ zipFilePath: filePath, entryName: entry.name }))
      );
      await zip.close();
    }
    return this.messageFiles;
  }
}
